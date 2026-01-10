const ANILIST_CLIENT_ID = 34336;
const REDIRECT_URI = "https://aruexp.github.io/antrack/auth/anilist/callback";

document.getElementById("anilistLogin").addEventListener("click", () => {
  const authUrl =
    "https://anilist.co/api/v2/oauth/authorize" +
    `?client_id=${ANILIST_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code`;

  window.location.href = authUrl;
});
