import { Redirect } from 'expo-router';

// Custom 404 handler: whenever Expo Router cannot match a route,
// send the user back to the main entry of the app which will handle routing
export default function NotFoundScreen() {
  return <Redirect href="/" />;
}
