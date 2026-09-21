import { Redirect } from 'expo-router';

// Preserve old links without retaining a Gift page or navigation entry.
export default function RetiredGiftRoute() {
  return <Redirect href="/" />;
}
