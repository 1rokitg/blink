const html = `
<!doctype html>
<html>
<head>
    <title>Blink Public API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta
      name="description"
      content="Reference docs for Blink's public API endpoints."
    />
</head>
<body>
    <script
      id="api-reference"
      data-url="/openapi.json"
      data-configuration="${JSON.stringify({
        theme: "purple",
        pageTitle: "Blink Public API",
        searchHotKey: "k",
        hideDownloadButton: false,
      }).replaceAll('"', "&quot;")}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>
`;

export function GET() {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}
