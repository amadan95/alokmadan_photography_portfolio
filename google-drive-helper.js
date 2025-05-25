// Google Drive Photo Integration Helper
// This script helps you easily add your Google Drive photos to the portfolio

/*
📸 HOW TO ADD YOUR GOOGLE DRIVE PHOTOS:

1. MAKE YOUR GOOGLE DRIVE FOLDER PUBLIC:
   - Open your Google Drive folder: https://drive.google.com/open?id=1URl3mve6-7agjG6Lxpto3pUTS2xhZaKb&usp=drive_fs
   - Right-click on the folder → "Share" → "Get link"
   - Set permissions to "Anyone with the link can view"

2. GET INDIVIDUAL PHOTO LINKS:
   For each photo in your folder:
   - Right-click on the photo → "Get link"
   - Make sure it's set to "Anyone with the link can view"
   - Copy the sharing URL (looks like: https://drive.google.com/file/d/LONG_FILE_ID/view)
   - Extract the FILE_ID (the long string between /d/ and /view)
   - Convert to direct image URL: https://drive.google.com/thumbnail?id=FILE_ID&sz=w800

3. REPLACE PHOTOS IN YOUR PORTFOLIO:
   - Open browser console (F12 → Console tab)
   - Run: addGoogleDrivePhotos(photoArray)
   
   Example:
   addGoogleDrivePhotos([
     'https://drive.google.com/thumbnail?id=YOUR_FILE_ID_1&sz=w800',
     'https://drive.google.com/thumbnail?id=YOUR_FILE_ID_2&sz=w800',
     // ... add more photos
   ]);
*/

// Helper function to convert Google Drive sharing URLs to direct image URLs
function convertGoogleDriveUrl(shareUrl) {
    if (shareUrl.includes('/file/d/')) {
        const fileId = shareUrl.match(/\/file\/d\/(.+?)\//)[1];
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`; // Use w800 for a good default size
    }
    // If it already looks like a thumbnail URL, return it as is
    if (shareUrl.includes('thumbnail?id=')) {
        return shareUrl;
    }
    // Fallback for other URL formats (though less likely for images)
    console.warn('Unrecognized Google Drive URL format:', shareUrl);
    return shareUrl; 
}

// Helper function to add Google Drive photos to the portfolio
function addGoogleDrivePhotos(photoUrls, customExifData = null) {
    if (!window.portfolio) {
        console.error('Portfolio not found. Make sure the main script has loaded.');
        return;
    }

    // Convert sharing URLs to direct image URLs
    const directUrls = photoUrls.map(url => convertGoogleDriveUrl(url));
    
    // Default EXIF data for street photography
    const defaultExifData = directUrls.map((url, index) => ({
        camera: 'Leica M6',
        lens: ['35mm', '50mm', '85mm'][index % 3],
        iso: ['400', '800', '1600'][Math.floor(Math.random() * 3)]
    }));

    // Use custom EXIF data if provided, otherwise use defaults
    const exifData = customExifData || defaultExifData;

    // Update the portfolio
    window.portfolio.replaceWithGoogleDrivePhotos(directUrls, exifData);
    
    console.log(`✅ Successfully added ${directUrls.length} photos from Google Drive!`);
    console.log('Photos added:', directUrls);
}

// Helper function to batch convert multiple sharing URLs
function convertMultipleUrls(shareUrls) {
    return shareUrls.map(url => convertGoogleDriveUrl(url));
}

// Example usage with your Google Drive folder
// Replace these with your actual photo sharing URLs
const exampleGoogleDrivePhotos = [
    // 'https://drive.google.com/file/d/YOUR_FILE_ID_1/view',
    // 'https://drive.google.com/file/d/YOUR_FILE_ID_2/view',
    // Add more URLs here...
];

// Example EXIF data (optional)
const exampleExifData = [
    { camera: 'Leica M6', lens: '35mm', iso: '400' },
    { camera: 'Leica M6', lens: '50mm', iso: '800' },
    // Add more EXIF data here...
];

// Instructions printed to console
console.log(`
🎬 GOOGLE DRIVE PHOTO INTEGRATION HELPER LOADED

Quick Start:
1. Get your Google Drive photo sharing URLs
2. Run: addGoogleDrivePhotos([...your URLs...])

Functions available:
- convertGoogleDriveUrl(shareUrl) - Convert sharing URL to direct image URL
- addGoogleDrivePhotos(urls, exifData) - Add photos to portfolio
- convertMultipleUrls(urls) - Convert multiple URLs at once

Example:
addGoogleDrivePhotos([
  'https://drive.google.com/file/d/1ABC123.../view', // Helper will convert this
  'https://drive.google.com/thumbnail?id=2DEF456...&sz=w800' // This will be used as is
]);
`);

// Auto-detect and process URLs from clipboard (if available)
if (navigator.clipboard && navigator.clipboard.readText) {
    function processClipboard() {
        navigator.clipboard.readText().then(text => {
            const urls = text.split('\n').filter(line => 
                line.includes('drive.google.com/file/d/')
            );
            
            if (urls.length > 0) {
                console.log(`📋 Found ${urls.length} Google Drive URLs in clipboard:`);
                console.log('Run this command to add them:');
                console.log(`addGoogleDrivePhotos(${JSON.stringify(urls, null, 2)});`);
            }
        }).catch(() => {
            // Clipboard access not available or denied
        });
    }
    
    // Check clipboard when this script loads
    processClipboard();
}

// Export functions for use in browser console
window.addGoogleDrivePhotos = addGoogleDrivePhotos;
window.convertGoogleDriveUrl = convertGoogleDriveUrl;
window.convertMultipleUrls = convertMultipleUrls;
