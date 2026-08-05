export default {
    async fetch(request, env) {
        // 0. Redirect /doki-world-tour (no trailing slash) to /doki-world-tour/
        const url = new URL(request.url);
        if (url.pathname === "/doki-world-tour") {
            url.pathname = "/doki-world-tour/";
            return Response.redirect(url.toString(), 301);
        }

        // 1. Attempt to fetch the requested asset
        const response = await env.ASSETS.fetch(request);

        // 2. Handle 404s
        if (response.status === 404) {
            const url = new URL(request.url);

            // Check if the URL path ends with a file extension (e.g., .css, .js, .png)
            const hasFileExtension = url.pathname.match(/\.[a-z0-9]+$/i);

            if (hasFileExtension) {
                // It's a missing static asset. Return the actual 404 response.
                return response;
            }

            // It's a navigation route (no extension). Fallback to the SPA's root.
            url.pathname = "/doki-world-tour/";
            return env.ASSETS.fetch(new Request(url, request));
        }

        // 3. Return the successfully found asset
        return response;
    },
};
