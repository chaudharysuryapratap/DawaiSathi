import asyncio
from base64 import b64encode

import pytest
from fastapi import HTTPException

import server


def test_medicine_image_upload_persists_safe_image(monkeypatch, tmp_path):
    monkeypatch.setattr(server, "MEDIA_ROOT", tmp_path)
    image = b"\x89PNG\r\n\x1a\nimage-data"

    response = asyncio.run(
        server.upload_medicine_image(
            server.MedicineImageUpload(
                content_type="image/png",
                image_base64=b64encode(image).decode("ascii"),
            )
        )
    )

    filename = response.image_url.rsplit("/", 1)[-1]
    assert response.image_url == f"/media/medicine-images/{filename}"
    assert (tmp_path / filename).read_bytes() == image


@pytest.mark.parametrize(
    ("content_type", "image"),
    [
        ("image/gif", b"GIF89aimage-data"),
        ("image/png", b"not-a-png"),
    ],
)
def test_medicine_image_upload_rejects_unsupported_or_mismatched_content(
    monkeypatch,
    tmp_path,
    content_type,
    image,
):
    monkeypatch.setattr(server, "MEDIA_ROOT", tmp_path)

    with pytest.raises(HTTPException) as rejected:
        asyncio.run(
            server.upload_medicine_image(
                server.MedicineImageUpload(
                    content_type=content_type,
                    image_base64=b64encode(image).decode("ascii"),
                )
            )
        )

    assert rejected.value.status_code == 415
    assert list(tmp_path.iterdir()) == []
