export const FEATURES = {
  // Micro Schedule Progress Integration
  ENABLE_MICRO_PROGRESS:
    process.env.ENABLE_MICRO_PROGRESS === 'false' ? false : true,

  // Other features can be added here
};

export function isFeatureEnabled(featureName: keyof typeof FEATURES): boolean {
  return FEATURES[featureName] === true;
}
