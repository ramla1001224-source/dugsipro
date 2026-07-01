export const getImageUrl = (path) => {
    if (!path || typeof path !== 'string') return null;
    
    // If it's already a full URL or Base64, return as is
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    
    // Handle old 'public/' prefix
    let cleanPath = path;
    if (path.startsWith('public/')) {
        cleanPath = path.replace('public/', '');
    }
    
    // Ensure base doesn't have trailing slash and suffix has leading slash
    const base = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const suffix = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    
    return `${base}${suffix}`;
};
