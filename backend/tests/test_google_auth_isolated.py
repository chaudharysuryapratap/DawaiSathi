import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

import server
from test_family_auth_isolated import isolated_auth_database  # noqa: F401


@pytest.fixture
def google_tokens(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = datetime.now(timezone.utc)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "isolated-google-test")])
    certificate = (
        x509.CertificateBuilder().subject_name(name).issuer_name(name)
        .public_key(key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(days=1)).sign(key, hashes.SHA256())
    )
    certs = json.dumps({"test-key": certificate.public_bytes(serialization.Encoding.PEM).decode()}).encode()
    monkeypatch.setattr(server, "GOOGLE_WEB_CLIENT_ID", "test-web-client.apps.googleusercontent.com")
    monkeypatch.setattr(server, "GoogleRequest", lambda: lambda *args, **kwargs: SimpleNamespace(status=200, data=certs))

    def token(**changes):
        claims = {
            "sub": "google-owner", "email": "owner@example.com", "email_verified": True,
            "name": "Google Owner", "iss": "https://accounts.google.com",
            "aud": server.GOOGLE_WEB_CLIENT_ID, "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=10)).timestamp()),
        }
        claims.update(changes)
        return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test-key"})

    return token


def test_google_signature_and_claim_validation(google_tokens, monkeypatch):
    assert server.verify_google_identity(google_tokens())["sub"] == "google-owner"
    for changes in (
        {"aud": "another-client"}, {"iss": "https://attacker.example"},
        {"exp": 1}, {"email_verified": False}, {"sub": ""},
    ):
        with pytest.raises(HTTPException) as error:
            server.verify_google_identity(google_tokens(**changes))
        assert error.value.status_code == 401
    with pytest.raises(HTTPException) as error:
        server.verify_google_identity("not-a-jwt")
    assert error.value.status_code == 401
    # A correctly shaped token signed by an untrusted key must also be rejected.
    claims = jwt.decode(google_tokens(), options={"verify_signature": False})
    forged_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    forged = jwt.encode(claims, forged_key, algorithm="RS256", headers={"kid": "test-key"})
    with pytest.raises(HTTPException) as error:
        server.verify_google_identity(forged)
    assert error.value.status_code == 401
    monkeypatch.setattr(server, "GOOGLE_WEB_CLIENT_ID", "")
    with pytest.raises(HTTPException) as error:
        server.verify_google_identity(google_tokens())
    assert error.value.status_code == 503


def test_google_clock_skew_is_bounded(google_tokens):
    now = int(datetime.now(timezone.utc).timestamp())
    # The local PC can trail Google's clock by a few seconds.
    assert server.verify_google_identity(google_tokens(iat=now + 5))["sub"] == "google-owner"
    for changes in ({"iat": now + 120}, {"exp": now - 120}):
        with pytest.raises(HTTPException) as error:
            server.verify_google_identity(google_tokens(**changes))
        assert error.value.status_code == 401


def test_google_linking_requires_password_and_optional_invites_work(isolated_auth_database, google_tokens):
    loop, database = isolated_auth_database

    async def exercise():
        async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as client:
            owner = await client.post("/api/auth/register", json={
                "name": "Owner", "email": "owner@example.com", "password": "a-strong-test-password",
                "bootstrap_token": "bootstrap-test-token",
            })
            assert owner.status_code == 200
            credential = {"id_token": google_tokens()}
            assert (await client.post("/api/auth/google", json=credential)).status_code == 409
            assert await database.users.count_documents({"google_sub": {"$exists": True}}) == 0
            assert (await client.post("/api/auth/google", json={**credential, "password": "incorrect"})).status_code == 401
            linked = await client.post("/api/auth/google", json={**credential, "password": "a-strong-test-password"})
            assert linked.status_code == 200
            assert linked.json()["user"]["id"] == owner.json()["user"]["id"]
            assert (await client.post("/api/auth/google", json=credential)).status_code == 200
            # Existing email/password access still works after linking.
            assert (await client.post("/api/auth/login", json={"email": "owner@example.com", "password": "a-strong-test-password"})).status_code == 200
            new_token = google_tokens(sub="google-member", email="member@example.com")
            group = (await database.family_groups.find_one({}, {"_id": 0}))["id"]
            invitation = await client.post(f"/api/family-groups/{group}/invites", headers={
                "Authorization": "Bearer " + owner.json()["access_token"],
            }, json={"email": "member@example.com"})
            assert invitation.status_code == 200
            invite = invitation.json()["token"]
            wrong_email = google_tokens(sub="another-google", email="other@example.com")
            assert (await client.post("/api/auth/google", json={"id_token": wrong_email, "invitation_token": invite})).status_code == 404
            member = await client.post("/api/auth/google", json={"id_token": new_token, "invitation_token": invite})
            assert member.status_code == 200
            assert member.json()["user"]["is_owner"] is False
            assert await database.family_groups.count_documents({"id": group, "user_ids": member.json()["user"]["id"]}) == 1
            assert (await client.post("/api/auth/google", json={"id_token": new_token})).status_code == 200
            assert await database.users.count_documents({}) == 2

    loop.run_until_complete(exercise())


def test_first_google_signup_does_not_claim_legacy_families(isolated_auth_database, google_tokens):
    loop, database = isolated_auth_database

    async def exercise():
        async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as client:
            token = google_tokens()
            result = await client.post("/api/auth/google", json={"id_token": token})
            assert result.status_code == 200
            assert result.json()["user"]["is_owner"] is False
            assert await database.family_groups.count_documents({"user_ids": result.json()["user"]["id"]}) == 0

    loop.run_until_complete(exercise())
