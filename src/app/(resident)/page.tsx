import { HomeScreen } from "@/components/HomeScreen";
import { FOOD_LINE } from "@/data/seed-listings";

export default function HomePage() {
  return <HomeScreen foodLinePhone={FOOD_LINE.phone} />;
}
