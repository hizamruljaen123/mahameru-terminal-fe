import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from './modelRegistry';

/**
 * Get a model definition by its ID.
 * @param {string} id - The model ID.
 * @returns {object} The model object or default model.
 */
export const getModelById = (id) => {
    return AVAILABLE_MODELS.find(m => m.id === id) || 
           AVAILABLE_MODELS.find(m => m.id === DEFAULT_MODEL_ID);
};

/**
 * Filter models by provider.
 * @param {string} provider - Provider name.
 * @returns {Array} Filtered models.
 */
export const getModelsByProvider = (provider) => {
    return AVAILABLE_MODELS.filter(m => m.provider === provider);
};

/**
 * Group models by provider for dropdowns.
 * @returns {object} Models grouped by provider.
 */
export const getModelsGroupedByProvider = () => {
    return AVAILABLE_MODELS.reduce((acc, model) => {
        if (!acc[model.provider]) acc[model.provider] = [];
        acc[model.provider].push(model);
        return acc;
    }, {});
};

/**
 * Get provider icon.
 * @param {string} id - Model ID.
 * @returns {string} Icon emoji.
 */
export const getModelIcon = (id) => {
    const model = getModelById(id);
    return model?.icon || '🤖';
};
