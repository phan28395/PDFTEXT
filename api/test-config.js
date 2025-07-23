// Test endpoint to check configuration
export default async function handler(req, res) {
  return res.status(200).json({
    hasCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    hasProjectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
    hasProcessorId: !!process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID,
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    processorId: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID,
    credentialsLength: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.length || 0
  });
}