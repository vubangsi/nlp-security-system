class NlpService {
  constructor(primaryAdapter, fallbackAdapter) {
    this.primaryAdapter = primaryAdapter;
    this.fallbackAdapter = fallbackAdapter;
  }

  async interpretCommand(command) {
    try {
      // Try primary adapter (Groq) first
      const result = await this.primaryAdapter.interpretCommand(command);
      
      if (result.success && result.confidence > 0.5) {
        return result;
      }
      
      // If primary fails or low confidence, try fallback
      console.log('Primary NLP adapter failed or low confidence, using fallback');
      return this.fallbackAdapter.interpretCommand(command);
      
    } catch (error) {
      console.error('Primary NLP adapter error:', error.message);
      console.log('Using fallback NLP adapter');
      
      // Use fallback adapter
      return this.fallbackAdapter.interpretCommand(command);
    }
  }
}

module.exports = NlpService;
