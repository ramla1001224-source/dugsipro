{{flutter_js}}
{{flutter_build_config}}

// Add a loading element to the DOM
const loadingIndicator = document.createElement('div');
loadingIndicator.id = 'loading_indicator';
loadingIndicator.innerHTML = `
<style>
  body {
    background-color: #0F172A; /* Dark navy matching portal */
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .loader-container {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .logo {
    width: 64px;
    height: 64px;
    background-color: #2563EB;
    border-radius: 18px;
    box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35);
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    font-size: 30px;
    font-weight: 900;
    margin-bottom: 24px;
  }
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top: 3px solid #3B82F6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  .text {
    margin-top: 20px;
    color: #94A3B8;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
<div class="loader-container">
  <div class="logo">S</div>
  <div class="spinner"></div>
  <div class="text">Loading Dugsi Pro System...</div>
</div>
`;
document.body.appendChild(loadingIndicator);

_flutter.loader.load({
  onEntrypointLoaded: async function(engineInitializer) {
    const appRunner = await engineInitializer.initializeEngine();
    
    // Remove the loading indicator right before running the app
    if (document.body.contains(loadingIndicator)) {
      document.body.removeChild(loadingIndicator);
    }
    
    await appRunner.runApp();
  }
});
