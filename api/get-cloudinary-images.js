const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with your credentials from Vercel Environment Variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Helper function to extract relevant EXIF data
// This is a basic example; you might need to adjust based on actual EXIF structure
function parseExif(exifData) {
    if (!exifData) return { iso: 'N/A', shutter: 'N/A', fStop: 'N/A', model: 'N/A', lens: 'N/A' };

    // Common EXIF tags (these might vary depending on camera/software)
    // Values often need parsing (e.g., "1/250" for shutter speed, "f/1.8" for aperture)
    const iso = exifData.ISOSpeedRatings || 'N/A';
    
    let shutter = 'N/A';
    if (exifData.ExposureTime) {
        if (exifData.ExposureTime < 1) {
            shutter = `1/${Math.round(1 / exifData.ExposureTime)}`;
        } else {
            shutter = `${exifData.ExposureTime}s`;
        }
    }

    let fStop = 'N/A';
    if (exifData.FNumber) {
        fStop = `f/${exifData.FNumber}`;
    } else if (exifData.ApertureValue) { // ApertureValue is often an APEX value, needs conversion
        // This is a simplified conversion, real APEX to f-number can be more complex
        // FNumber = 2^(ApertureValue/2)
        // For now, if FNumber is not present, we'll just show the raw ApertureValue if available
        // Or attempt a basic interpretation if it looks like "X/Y"
        if (typeof exifData.ApertureValue === 'string' && exifData.ApertureValue.includes('/')) {
             try {
                const parts = exifData.ApertureValue.split('/');
                const val = parseFloat(parts[0]) / parseFloat(parts[1]);
                fStop = `f/${val.toFixed(1)}`;
             } catch (e) { /* ignore parsing error */ }
        } else if (typeof exifData.ApertureValue === 'number') {
             fStop = `f/${exifData.ApertureValue.toFixed(1)}`; // Or some other formatting
        }
    }


    const model = exifData.Model || 'N/A';
    const lens = exifData.LensModel || exifData.Lens || 'N/A'; // LensModel is more standard

    return {
        iso: iso.toString(), // Ensure string
        shutter,
        fStop,
        model,
        lens
    };
}


export default async function handler(request, response) {
  try {
    const results = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'image',
      prefix: 'portfolio/', // Fetch images from the 'portfolio' folder
      max_results: 500,    // Adjust if you have more than 500 images
      image_metadata: true // Request EXIF data
    });

    const images = results.resources.map(resource => ({
      id: resource.asset_id, // Or use public_id if you prefer and it's unique
      src: resource.secure_url,
      width: resource.width,
      height: resource.height,
      filename: resource.filename,
      public_id: resource.public_id,
      exif: parseExif(resource.image_metadata ? resource.image_metadata.EXIF : null),
      exifRaw: resource.image_metadata ? resource.image_metadata.EXIF : null // Keep raw for debugging if needed
    }));

    response.status(200).json({ images });

  } catch (error) {
    console.error('Error fetching images from Cloudinary:', error);
    response.status(500).json({ error: 'Failed to fetch images', details: error.message });
  }
} 