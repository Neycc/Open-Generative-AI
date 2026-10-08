// Single source of truth lives in the studio workspace package.
// See packages/studio/src/models.js. This file exists only so the
// standalone (Electron/Vite) build's existing imports of "../lib/models"
// keep resolving without touching every consumer.
export * from "studio/src/models.js";

export {
    t2iModels, i2iModels, t2vModels, i2vModels, v2vModels,
    getAspectRatiosForModel, getResolutionsForModel, getQualityFieldForModel,
    getAspectRatiosForI2IModel, getResolutionsForI2IModel, getQualityFieldForI2IModel, getMaxImagesForI2IModel,
    getAspectRatiosForVideoModel, getDurationsForModel, getResolutionsForVideoModel,
    getAspectRatiosForI2VModel, getDurationsForI2VModel, getResolutionsForI2VModel,
} from './higgsfieldModels.js';
