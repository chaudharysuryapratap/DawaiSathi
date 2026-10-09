import { useRouter } from "expo-router";
import { InboxSheet } from "@/src/components/inbox-sheet";

// Keep existing deep links working; the Today bell opens the sheet in place.
export default function InboxScreen() {
  const router = useRouter();
  return <InboxSheet visible onClose={() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }}/>;
}
