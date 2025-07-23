// Simple PDF to text API for testing
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For now, return dummy response to test the flow
    const dummyResponse = {
      success: true,
      text_content: "This is a test conversion. Your PDF processing is working! The actual Google Document AI integration needs to be configured with proper credentials.",
      pages_count: 1,
      processing_time: 1200,
      confidence: 0.95
    };

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    return res.status(200).json(dummyResponse);

  } catch (error) {
    console.error('Processing error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Processing failed' 
    });
  }
}