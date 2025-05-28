# Photography Portfolio - Alok Madan

A stunning photography portfolio website designed to mimic the aesthetic of film contact sheets with parallax pen annotations and EXIF data display.

## Features

### 🎬 Film Contact Sheet Aesthetic
- **Authentic film strip borders** with perforations on the sides
- **Black background** with film-style gradient effects
- **Frame numbers** on each photo like real contact sheets
- **Professional typography** using JetBrains Mono font

### 📸 EXIF Data Display
Each photo frame displays realistic EXIF metadata including:
- Camera model
- Lens information
- Focal length
- Aperture settings
- Shutter speed
- ISO values
- Date taken

### ✏️ Parallax Pen Annotations
As users scroll, white ink pen effects appear with:
- **Circles** around selected photos
- **Cross marks** over rejected shots
- **Written notes** like "BEST SHOT"
- **Smooth animations** triggered by scroll position

### 📱 Responsive Design
- Mobile-optimized layout
- Touch-friendly interactions
- Adaptive grid system
- Smooth scrolling navigation

## File Structure

```
photography-portfolio/
├── index.html          # Main HTML structure
├── styles.css          # Film contact sheet styling
├── script.js           # Interactive features & animations
└── README.md           # This file
```

## Setup Instructions

1. **Clone or download** the project files
2. **Open `index.html`** in a web browser
3. **Customize** the content as needed

## Adding Your Photos

To add your photos, you need to place them in an `images` folder within your project directory and then update the `script.js` file to correctly load them.

1.  **Create an `images` folder** in the `photography-portfolio` directory.
2.  **Add your photo files** (e.g., `photo_001.jpg`, `photo_002.jpg`, etc.) to this `images` folder.
3.  **Update `script.js`:**
    *   Modify the `totalPhotos` variable (around line 7) in `script.js` to match the number of photos you have.
    *   The script expects photos to be named in the format `photo_XXX.jpg` (e.g., `photo_001.jpg`). If your photos have different names or formats, you'll need to adjust the `loadPhotos` method in `script.js` accordingly.

Example of `loadPhotos` if your files are named differently or you want to list them explicitly:

```javascript
// In script.js, inside the PhotographyPortfolio class

loadPhotos() {
    this.photos = [
        { id: 1, src: 'images/your_first_image.jpg', exif: { /* initial exif */ } },
        { id: 2, src: 'images/another_photo.png', exif: { /* initial exif */ } },
        // ... add all your photos here
    ];
    this.totalPhotos = this.photos.length;
    this.photosLoadedCount = 0;
    this.renderPhotoGrid(); // Initial render
    this.photos.forEach((photo, index) => {
        this.extractExifData(photo, index);
    });
}
```

This method allows for automatic EXIF data extraction from your local image files.

## Customization

### Colors & Styling
Edit `styles.css` to change:
- Background colors
- Text colors
- Film border styling
- Animation effects

### Pen Annotations
Modify `initializePenAnimations()` in `script.js` to:
- Change pen positions
- Add more annotations
- Customize scroll triggers
- Modify animation styles

### Layout
Adjust the grid layout in the `.photo-grid` CSS class:
```css
.photo-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 30px;
}
```

### EXIF Integration
The structure supports:
- **Real EXIF data** extraction from local image files using the `exif-js` library.
- **Custom metadata** display if EXIF data is unavailable or needs overriding.
- **Flexible formatting** options in the modal display.

## Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

## Performance Optimizations

- **Lazy loading** for images
- **Efficient scroll listeners** with throttling
- **Optimized animations** using CSS transforms
- **Responsive image sizing**

## Deployment

### GitHub Pages
1. Push to a GitHub repository
2. Enable GitHub Pages in repository settings
3. Your site will be available at `username.github.io/repository-name`

### Netlify
1. Drag and drop the folder to [Netlify Drop](https://app.netlify.com/drop)
2. Get instant deployment with custom domain support

### Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project directory
3. Follow the deployment prompts

## Technical Details

### Parallax Effects
The pen animations use:
- **SVG elements** for smooth vector graphics
- **Scroll-based triggers** for timing
- **CSS transforms** for performance
- **Opacity transitions** for smooth appearance

### Film Aesthetic
Achieved through:
- **CSS gradients** for film borders
- **Repeating patterns** for perforations
- **Box shadows** for depth
- **Monospace fonts** for technical feel

### EXIF Integration
The structure supports:
- **Real EXIF data** extraction from local image files using the `exif-js` library.
- **Custom metadata** display if EXIF data is unavailable or needs overriding.
- **Flexible formatting** options in the modal display.

## Future Enhancements

- [ ] Image upload interface for easier photo management
- [ ] Full-screen lightbox gallery with enhanced navigation
- [ ] Social media sharing options
- [ ] Contact form integration
- [ ] Advanced EXIF data editing or annotation

## License

This project is open source and available under the MIT License.

## Credits

- **Design inspiration**: Traditional film contact sheets
- **Placeholder images**: Unsplash.com
- **Fonts**: Google Fonts (JetBrains Mono)
- **Icons**: Custom SVG implementations

---

**Need help?** Feel free to customize the code to match your specific requirements!
