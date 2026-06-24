/**
 * DEPRECATED: This route is deprecated in favor of /ar-view.
 * Redirecting all traffic to the unified AR View.
 */
import { Redirect } from 'expo-router';
import React from 'react';

export default function ARFurnitureRedirect() {
  return <Redirect href="/ar-view" />;
}
