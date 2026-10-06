import { ResultsScreen } from "@/components/ResultsScreen";
import { FOOD_LINE } from "@/data/seed-listings";

export default function SearchPage() {
  return <ResultsScreen foodLinePhone={FOOD_LINE.phone} />;
}
