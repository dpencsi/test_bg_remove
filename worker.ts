import { AutoModel, AutoProcessor, env, RawImage } from '@xenova/transformers';

env.allowRemoteModels = false;
env.useBrowserCache = false;

let model = null;
let processor = null;

// Load the model and processor
async function loadModel() {
    try {
        if (!model) {
            console.log("Loading model...");
            model = await AutoModel.from_pretrained('RMBG-1.4', {
                config: { model_type: 'custom' }
            });
            console.log("Model loaded");
        }

        if (!processor) {
            console.log("Loading processor...");
            processor = await AutoProcessor.from_pretrained('RMBG-1.4', {
                config: {
                    do_normalize: true,
                    do_pad: false,
                    do_rescale: true,
                    do_resize: true,
                    image_mean: [0.5, 0.5, 0.5],
                    feature_extractor_type: "ImageFeatureExtractor",
                    image_std: [1, 1, 1],
                    resample: 2,
                    rescale_factor: 0.00392156862745098,
                    size: { width: 1024, height: 1024 },
                }
            });
            console.log("Processor loaded");
        }

        // Notify that the model and processor have been loaded
        self.postMessage({ status: 'model-loaded' });
    } catch (error) {
        console.error("Failed to load model or processor:", error);
        self.postMessage({ status: 'model-load-failed', error: error.message });
    }
}

// Process an image
async function processImage(imageUrl, index) {
    try {
        console.log(`File: ${index}`);
        // Read image
        const image = await RawImage.fromURL(imageUrl);

        // Preprocess image
        const { pixel_values } = await processor(image);

        // Predict alpha matte
        const { output } = await model({ input: pixel_values });

        // Resize mask back to original size
        const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height);

        // Create new canvas
        const canvas = new OffscreenCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // Draw original image output to canvas
        ctx.drawImage(await image.toCanvas(), 0, 0);

        // Update alpha channel
        const pixelData = ctx.getImageData(0, 0, image.width, image.height);

        for (let i = 0; i < mask.data.length; ++i) {
            pixelData.data[4 * i + 3] = mask.data[i];
        }

        ctx.putImageData(pixelData, 0, 0);

        // Convert canvas to Blob
        const processedImageBlob = await canvas.convertToBlob();

        // Convert Blob to Base64 string
        const reader = new FileReader();

        reader.onloadend = () => {
            self.postMessage({
                status: 'complete',
                output: reader.result,
                index
            });
        };
        reader.readAsDataURL(processedImageBlob);

    } catch (error) {
        self.postMessage({ status: 'error', error: error.message, index });
    }
}

// Handle incoming messages
self.addEventListener('message', async (event) => {
    if (!model || !processor) {
        await loadModel();
    }

    if (event.data.imageFiles) {

        event.data.imageFiles.forEach((file: File, index:  number) => {
            const reader = new FileReader();
            reader.onload = async () => {
                await processImage(reader.result, index);
            };
            reader.readAsDataURL(file);
        });
    }
});

// Load the model initially when the worker starts
loadModel();
