import { router } from "expo-router";
import { Button } from "react-native";

// Inside your screen component:
<Button
  title="Play Chess"
  onPress={() => router.push("/chess")}
/>