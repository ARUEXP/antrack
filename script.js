const API_URL = "https://graphql.anilist.co";
let currentPage = 1;
let currentQuery = null;
let currentVariables = {};
let currentView = "grid";
let myList = JSON.parse(localStorage.getItem("animeList") || "[]");

let isPortraitSearchActive = false;

// Initialize with trending anime
window.addEventListener("DOMContentLoaded", () => {
  loadTrending();
  updateMyListCount();

  // Handle Orientation/Tab Logic for Portrait
  handlePortraitLayout();

  // Add enter key support for search
  document.getElementById("searchInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      searchAnime();
    }
  });
});

function handlePortraitLayout() {
  const isPortrait = window.matchMedia("(max-width: 639px)").matches;

  // Ignore keyboard-triggered resize when search is open
  if (isPortrait && isPortraitSearchActive) return;

  if (isPortrait) {
    switchPortraitTab("home");
  } else {
    document.getElementById("searchViewSection").classList.remove("hidden");
    document.getElementById("homeViewSection").classList.remove("hidden");
  }
}

window.addEventListener("resize", () => {
  requestAnimationFrame(handlePortraitLayout);
});

function toggleSideMenu() {
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("sideMenuOverlay");
  const isOpen = !sideMenu.classList.contains("-translate-x-full");

  if (isOpen) {
    sideMenu.classList.add("-translate-x-full");
    overlay.classList.add("hidden");
    overlay.classList.remove("opacity-100");
    overlay.classList.add("opacity-0");
  } else {
    sideMenu.classList.remove("-translate-x-full");
    overlay.classList.remove("hidden");
    setTimeout(() => {
      overlay.classList.remove("opacity-0");
      overlay.classList.add("opacity-100");
    }, 10);
  }
}

function switchPortraitTab(tab) {
  const searchSection = document.getElementById("searchViewSection");
  const homeSection = document.getElementById("homeViewSection");
  const homeBtn = document.getElementById("portraitHomeBtn");
  const searchBtn = document.getElementById("portraitSearchBtn");
  const sideMenu = document.getElementById("sideMenu");

  // Update global state FIRST
  isPortraitSearchActive = tab === "search";

  if (tab === "home") {
    searchSection.classList.add("hidden");
    homeSection.classList.remove("hidden");

    homeBtn.classList.add("bg-accent", "text-foreground");
    homeBtn.classList.remove("text-muted-foreground");

    searchBtn.classList.add("text-muted-foreground");
    searchBtn.classList.remove("bg-accent", "text-foreground");
  } else {
    homeSection.classList.add("hidden");
    searchSection.classList.remove("hidden", "sm:block");

    searchBtn.classList.add("bg-accent", "text-foreground");
    searchBtn.classList.remove("text-muted-foreground");

    homeBtn.classList.add("text-muted-foreground");
    homeBtn.classList.remove("bg-accent", "text-foreground");

    // Focus search input safely (prevents resize race)
    requestAnimationFrame(() => {
      const input = document.getElementById("searchInput");
      if (input) input.focus({ preventScroll: true });
    });
  }

  // Close side menu if open
  if (sideMenu && !sideMenu.classList.contains("-translate-x-full")) {
    toggleSideMenu();
  }
}

function toggleMobileSearch() {
  // Re-using search tab logic for the old mobile search button if present
  switchPortraitTab("search");
}

async function queryAniList(query, variables = {}, append = false) {
  const loading = document.getElementById("loading");
  loading.classList.remove("hidden");
  loading.classList.add("flex");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error:", error);
    return null;
  } finally {
    loading.classList.add("hidden");
    loading.classList.remove("flex");
  }
}

function getMediaQuery() {
  return `
          id
          title {
              romaji
              english
          }
          coverImage {
              large
              extraLarge
          }
          bannerImage
          averageScore
          episodes
          duration
          status
          season
          seasonYear
          format
          genres
          studios {
              nodes {
                  name
              }
          }
          description
          nextAiringEpisode {
              airingAt
              episode
          }
          externalLinks {
              site
              url
          }
          trailer {
              id
              site
          }
          relations {
              edges {
                  relationType
                  node {
                      id
                      title {
                          romaji
                          english
                      }
                      coverImage {
                          large
                      }
                      type
                  }
              }
          }
          characters(page: 1, perPage: 6, sort: ROLE) {
              edges {
                  role
                  node {
                      id
                      name {
                          full
                      }
                      image {
                          large
                      }
                  }
              }
          }
      `;
}

async function searchAnime(isMobile = false) {
  const inputId = isMobile ? "mobileSearchInput" : "searchInput";
  const searchTerm = document.getElementById(inputId).value.trim();
  if (!searchTerm) return;

  if (isMobile) toggleMobileSearch();

  currentPage = 1;
  const query = `
          query ($search: String, $page: Int, $perPage: Int) {
              Page(page: $page, perPage: $perPage) {
                  pageInfo {
                      hasNextPage
                  }
                  media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
                      ${getMediaQuery()}
                  }
              }
          }
      `;

  currentQuery = query;
  currentVariables = {
    search: searchTerm,
    page: currentPage,
    perPage: 24,
  };

  const data = await queryAniList(query, currentVariables);
  if (data && data.Page) {
    displayAnime(data.Page.media);
    updateLoadMore(data.Page.pageInfo.hasNextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function toggleFilters() {
  const panel = document.getElementById("filtersPanel");
  panel.classList.toggle("hidden");
}

function applyFilters(isMobile = false) {
  currentPage = 1;
  let genre, year, format, status;

  if (isMobile) {
    genre = document.getElementById("mobileGenreFilter").value;
    year = document.getElementById("mobileYearFilter").value;
    format = null; // Basic mobile filters
    status = null;
    toggleMobileSearch();
  } else {
    genre = document.getElementById("genreFilter").value;
    year = document.getElementById("yearFilter").value;
    format = document.getElementById("formatFilter").value;
    status = document.getElementById("statusFilter").value;
  }

  const query = `
          query ($page: Int, $perPage: Int, $genre: String, $year: Int, $format: MediaFormat, $status: MediaStatus) {
              Page(page: $page, perPage: $perPage) {
                  pageInfo {
                      hasNextPage
                  }
                  media(type: ANIME, genre: $genre, seasonYear: $year, format: $format, status: $status, sort: POPULARITY_DESC) {
                      ${getMediaQuery()}
                  }
              }
          }
      `;

  currentQuery = query;
  currentVariables = {
    page: currentPage,
    perPage: 24,
    genre: genre || null,
    year: year ? parseInt(year) : null,
    format: format || null,
    status: status || null,
  };

  queryAniList(query, currentVariables).then((data) => {
    if (data && data.Page) {
      displayAnime(data.Page.media);
      updateLoadMore(data.Page.pageInfo.hasNextPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

function clearFilters() {
  document.getElementById("genreFilter").value = "";
  document.getElementById("yearFilter").value = "";
  document.getElementById("formatFilter").value = "";
  document.getElementById("statusFilter").value = "";
  loadTrending();
}

async function loadTrending() {
  currentPage = 1;
  const query = `
          query ($page: Int, $perPage: Int) {
              Page(page: $page, perPage: $perPage) {
                  pageInfo {
                      hasNextPage
                  }
                  media(type: ANIME, sort: TRENDING_DESC) {
                      ${getMediaQuery()}
                  }
              }
          }
      `;

  currentQuery = query;
  currentVariables = { page: currentPage, perPage: 24 };

  const data = await queryAniList(query, currentVariables);
  if (data && data.Page) {
    displayAnime(data.Page.media);
    updateLoadMore(data.Page.pageInfo.hasNextPage);
  }
}

async function loadPopular() {
  currentPage = 1;
  const query = `
          query ($page: Int, $perPage: Int) {
              Page(page: $page, perPage: $perPage) {
                  pageInfo {
                      hasNextPage
                  }
                  media(type: ANIME, sort: POPULARITY_DESC) {
                      ${getMediaQuery()}
                  }
              }
          }
      `;

  currentQuery = query;
  currentVariables = { page: currentPage, perPage: 24 };

  const data = await queryAniList(query, currentVariables);
  if (data && data.Page) {
    displayAnime(data.Page.media);
    updateLoadMore(data.Page.pageInfo.hasNextPage);
  }
}

async function loadTopRated() {
  currentPage = 1;
  const query = `
          query ($page: Int, $perPage: Int) {
              Page(page: $page, perPage: $perPage) {
                  pageInfo {
                      hasNextPage
                  }
                  media(type: ANIME, sort: SCORE_DESC) {
                      ${getMediaQuery()}
                  }
              }
          }
      `;

  currentQuery = query;
  currentVariables = { page: currentPage, perPage: 24 };

  const data = await queryAniList(query, currentVariables);
  if (data && data.Page) {
    displayAnime(data.Page.media);
    updateLoadMore(data.Page.pageInfo.hasNextPage);
  }
}

async function loadAiring() {
  currentPage = 1;
  const query = `
          query ($page: Int, $perPage: Int) {
              Page(page: $page, perPage: $perPage) {
                  pageInfo {
                      hasNextPage
                  }
                  media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
                      ${getMediaQuery()}
                  }
              }
          }
      `;

  currentQuery = query;
  currentVariables = { page: currentPage, perPage: 24 };

  const data = await queryAniList(query, currentVariables);
  if (data && data.Page) {
    displayAnime(data.Page.media);
    updateLoadMore(data.Page.pageInfo.hasNextPage);
  }
}

async function loadMore() {
  if (!currentQuery) return;

  currentPage++;
  currentVariables.page = currentPage;

  const data = await queryAniList(currentQuery, currentVariables);
  if (data && data.Page) {
    const results = document.getElementById("results");
    data.Page.media.forEach((anime) => {
      results.appendChild(createAnimeCard(anime));
    });
    updateLoadMore(data.Page.pageInfo.hasNextPage);
  }
}

function updateLoadMore(hasNextPage) {
  const container = document.getElementById("loadMoreContainer");
  if (hasNextPage) {
    container.classList.remove("hidden");
  } else {
    container.classList.add("hidden");
  }
}

function displayAnime(animeList) {
  const results = document.getElementById("results");
  results.innerHTML = "";

  animeList.forEach((anime, index) => {
    const card = createAnimeCard(anime);
    // Staggered animation
    card.style.animationDelay = `${index * 40}ms`;
    card.classList.add("stagger-item");
    results.appendChild(card);
  });
}

function createAnimeCard(anime) {
  const title = anime.title.english || anime.title.romaji;
  const score = anime.averageScore ? anime.averageScore / 10 : "N/A";
  const isInList = myList.some((item) => item.id === anime.id);

  const card = document.createElement("div");
  card.className = "cn-card group cursor-pointer";
  card.onclick = () => showAnimeDetails(anime.id);

  card.innerHTML = `
          <div class="relative overflow-hidden aspect-[3/4]">
              <img src="${
                anime.coverImage.large
              }" alt="${title}" class="w-full h-full object-cover card-image-zoom">
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div class="absolute top-2 right-2 z-10">
                  <span class="cn-badge cn-badge-secondary bg-black/60 backdrop-blur-md border border-white/10 text-[10px] h-5 transition-transform group-hover:scale-110">
                      ${score}
                  </span>
              </div>
              <button onclick="event.stopPropagation(); toggleMyList(${
                anime.id
              }, '${title.replace(/'/g, "\\'")}', '${anime.coverImage.large}')" 
                      class="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:scale-110 active:scale-90 transition-all z-10"
                      data-id="${anime.id}">
                  <i class="${
                    isInList ? "iconoir-bookmark-solid" : "iconoir-bookmark"
                  } text-sm"></i>
              </button>
          </div>
          <div class="p-3">
              <h3 class="font-semibold text-sm mb-2 line-clamp-1 tracking-tight group-hover:text-primary transition-colors">${title}</h3>
              <div class="flex gap-1.5 flex-wrap">
                  ${anime.genres
                    .slice(0, 1)
                    .map(
                      (genre) =>
                        `<span class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider group-hover:text-foreground transition-colors">${genre}</span>`
                    )
                    .join("")}
                  <span class="text-[10px] text-muted-foreground opacity-50">•</span>
                  <span class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider group-hover:text-foreground transition-colors">${
                    anime.format || "TV"
                  }</span>
              </div>
          </div>
      `;

  return card;
}

function setView(view) {
  currentView = view;
  const results = document.getElementById("results");
  const gridBtn = document.getElementById("gridViewBtn");
  const listBtn = document.getElementById("listViewBtn");

  if (view === "grid") {
    results.className =
      "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6";
    gridBtn.classList.add("active");
    listBtn.classList.remove("active");
  } else {
    results.className = "flex flex-col gap-4";
    listBtn.classList.add("active");
    gridBtn.classList.remove("active");
  }
}

function toggleMyList(id, title, image) {
  const index = myList.findIndex((item) => item.id === id);
  if (index > -1) {
    myList.splice(index, 1);
  } else {
    myList.push({ id, title, image });
  }

  localStorage.setItem("animeList", JSON.stringify(myList));
  updateMyListCount();

  // Update button state
  const buttons = document.querySelectorAll(`[data-id="${id}"]`);
  buttons.forEach((btn) => {
    const icon = btn.querySelector("i");
    if (index > -1) {
      btn.classList.remove("active");
      icon.className = "iconoir-bookmark text-lg";
    } else {
      btn.classList.add("active");
      icon.className = "iconoir-bookmark-solid text-lg";
    }
  });
}

function updateMyListCount() {
  document.getElementById("myListCount").textContent = myList.length;
}

function showMyList() {
  const modal = document.getElementById("myListModal");
  const content = document.getElementById("myListContent");

  if (myList.length === 0) {
    content.innerHTML =
      '<div class="col-span-full py-20 text-center space-y-4"><i class="iconoir-bookmark-circle text-5xl opacity-20"></i><p class="text-muted-foreground font-medium">Your library is currently empty</p></div>';
  } else {
    content.innerHTML = "";
    myList.forEach((anime) => {
      const card = document.createElement("div");
      card.className = "cn-card group cursor-pointer";
      card.onclick = () => showAnimeDetails(anime.id);

      card.innerHTML = `
                  <div class="relative overflow-hidden aspect-[3/4]">
                      <img src="${anime.image}" alt="${
        anime.title
      }" class="w-full h-full object-cover card-image-zoom">
                      <button onclick="event.stopPropagation(); toggleMyList(${
                        anime.id
                      }, '${anime.title.replace(/'/g, "\\'")}', '${
        anime.image
      }'); showMyList();" 
                              class="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-colors"
                              data-id="${anime.id}">
                          <i class="iconoir-bookmark-solid text-sm"></i>
                      </button>
                  </div>
                  <div class="p-3">
                      <h3 class="font-semibold text-xs truncate tracking-tight">${
                        anime.title
                      }</h3>
                  </div>
              `;

      content.appendChild(card);
    });
  }

  modal.classList.remove("hidden");
}

function closeMyListModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById("myListModal").classList.add("hidden");
}

async function showAnimeDetails(animeId) {
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modalContent");
  const modalBox = modal.querySelector("div");

  modalContent.innerHTML =
    '<div class="flex justify-center py-12"><div class="loading"></div></div>';
  modal.classList.remove("hidden");
  modal.classList.add("animate-fade");
  modalBox.classList.add("animate-scale-in");

  const query = `
          query ($id: Int) {
              Media(id: $id, type: ANIME) {
                  ${getMediaQuery()}
              }
          }
      `;

  const data = await queryAniList(query, { id: animeId });
  if (!data || !data.Media) return;

  const anime = data.Media;
  const title = anime.title.english || anime.title.romaji;
  const score = anime.averageScore ? anime.averageScore / 10 : "N/A";
  const description = anime.description
    ? anime.description.replace(/<[^>]*>/g, "")
    : "No description available.";
  const isInList = myList.some((item) => item.id === anime.id);

  const streamingLinks =
    anime.externalLinks?.filter((link) =>
      ["Crunchyroll", "Netflix", "Hulu", "Amazon", "Disney Plus"].includes(
        link.site
      )
    ) || [];

  const relatedAnime =
    anime.relations?.edges
      ?.filter(
        (edge) =>
          edge.node.type === "ANIME" &&
          ["SEQUEL", "PREQUEL", "ALTERNATIVE", "ADAPTATION"].includes(
            edge.relationType
          )
      )
      .slice(0, 6) || [];

  modalContent.innerHTML = `
          <div class="grid lg:grid-cols-12 gap-6 sm:gap-10 animate-fade">
              <div class="lg:col-span-4 space-y-4 sm:space-y-6">
                  <div class="aspect-[3/4] rounded-xl sm:rounded-2xl overflow-hidden border shadow-sm max-w-[200px] mx-auto lg:max-w-full">
                      <img src="${
                        anime.coverImage.extraLarge || anime.coverImage.large
                      }" alt="${title}" class="w-full h-full object-cover animate-fade">
                  </div>
                  
                  <button onclick="toggleMyList(${anime.id}, '${title.replace(
    /'/g,
    "\\'"
  )}', '${anime.coverImage.large}')" 
                          class="cn-button cn-button-primary w-full h-11 sm:h-12 text-xs sm:text-sm ${
                            isInList ? "active" : ""
                          }"
                          data-id="${anime.id}">
                      <i class="${
                        isInList ? "iconoir-bookmark-solid" : "iconoir-bookmark"
                      } text-base"></i>
                      <span>${
                        isInList ? "Saved in Library" : "Add to Library"
                      }</span>
                  </button>

                  <div class="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-muted/30 border space-y-4">
                      <div class="grid grid-cols-2 gap-3 sm:gap-4">
                          <div>
                              <p class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Score</p>
                              <p class="text-lg sm:text-xl font-bold">${score}</p>
                          </div>
                          <div>
                              <p class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Format</p>
                              <p class="text-lg sm:text-xl font-bold">${
                                anime.format || "N/A"
                              }</p>
                          </div>
                          <div>
                              <p class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Episodes</p>
                              <p class="text-lg sm:text-xl font-bold">${
                                anime.episodes || "?"
                              }</p>
                          </div>
                          <div>
                              <p class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Year</p>
                              <p class="text-lg sm:text-xl font-bold">${
                                anime.seasonYear || "TBA"
                              }</p>
                          </div>
                      </div>
                  </div>
              </div>
              
              <div class="lg:col-span-8">
                  <div class="mb-4 sm:mb-8">
                      <h2 class="text-2xl sm:text-4xl font-bold tracking-tight mb-1 sm:mb-2">${title}</h2>
                      <p class="text-muted-foreground text-xs sm:text-sm font-medium tracking-wide italic opacity-60">${
                        anime.title.romaji !== title ? anime.title.romaji : ""
                      }</p>
                  </div>
                  
                  ${
                    anime.nextAiringEpisode
                      ? `
                  <div class="flex items-center gap-3 p-3 sm:p-4 bg-primary text-primary-foreground rounded-lg sm:rounded-xl mb-6 sm:mb-8 animate-pulse shadow-lg shadow-white/5">
                      <i class="iconoir-clock text-lg sm:text-xl"></i>
                      <div>
                          <p class="text-[9px] sm:text-[10px] font-bold uppercase opacity-80">Next Episode Countdown</p>
                          <p class="text-xs sm:text-sm font-bold">Episode ${
                            anime.nextAiringEpisode.episode
                          } airs ${getTimeUntil(
                          anime.nextAiringEpisode.airingAt
                        )}</p>
                      </div>
                  </div>
                  `
                      : ""
                  }
                  
                  <!-- Modal Tabs -->
                  <div class="cn-tabs mb-6 sm:mb-8 flex flex-wrap gap-1">
                      <button onclick="switchModalTab(this, 'overview')" class="cn-tabs-trigger active flex-1 sm:flex-none">Overview</button>
                      ${
                        anime.characters?.edges?.length > 0
                          ? '<button onclick="switchModalTab(this, \'characters\')" class="cn-tabs-trigger flex-1 sm:flex-none">Characters</button>'
                          : ""
                      }
                      ${
                        relatedAnime.length > 0
                          ? '<button onclick="switchModalTab(this, \'related\')" class="cn-tabs-trigger flex-1 sm:flex-none">Related</button>'
                          : ""
                      }
                      ${
                        streamingLinks.length > 0 || anime.trailer
                          ? '<button onclick="switchModalTab(this, \'watch\')" class="cn-tabs-trigger flex-1 sm:flex-none">Streaming</button>'
                          : ""
                      }
                  </div>
                  
                  <!-- Tab Content -->
                  <div id="modalTabContent" class="space-y-6 sm:space-y-8 min-h-[300px]">
                      <div id="overview" class="tab-pane space-y-6 sm:space-y-8">
                          <div class="space-y-2 sm:space-y-3">
                              <h3 class="text-xs sm:text-sm font-bold uppercase tracking-widest text-muted-foreground">Synopsis</h3>
                              <p class="text-muted-foreground leading-relaxed text-xs sm:text-sm md:text-base">${description}</p>
                          </div>
                          
                          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                              <div class="space-y-2 sm:space-y-3">
                                  <h3 class="text-xs sm:text-sm font-bold uppercase tracking-widest text-muted-foreground">Details</h3>
                                  <div class="space-y-1 sm:space-y-2">
                                      <p class="text-xs sm:text-sm"><span class="text-muted-foreground mr-2">Status:</span> ${
                                        anime.status
                                      }</p>
                                      <p class="text-xs sm:text-sm"><span class="text-muted-foreground mr-2">Studio:</span> ${
                                        anime.studios?.nodes
                                          ?.map((s) => s.name)
                                          .join(", ") || "N/A"
                                      }</p>
                                      <p class="text-xs sm:text-sm"><span class="text-muted-foreground mr-2">Duration:</span> ${
                                        anime.duration
                                          ? anime.duration + " min"
                                          : "N/A"
                                      }</p>
                                  </div>
                              </div>
                              <div class="space-y-2 sm:space-y-3">
                                  <h3 class="text-xs sm:text-sm font-bold uppercase tracking-widest text-muted-foreground">Genres</h3>
                                  <div class="flex flex-wrap gap-1.5 sm:gap-2">
                                      ${anime.genres
                                        .map(
                                          (genre) =>
                                            `<span class="cn-badge cn-badge-outline border-white/20 text-[9px] sm:text-[10px] hover:border-white/50 transition-colors">${genre}</span>`
                                        )
                                        .join("")}
                                  </div>
                              </div>
                          </div>
                      </div>
                      
                      ${
                        anime.characters?.edges?.length > 0
                          ? `
                      <div id="characters" class="tab-pane hidden">
                          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              ${anime.characters.edges
                                .map(
                                  (char) => `
                                  <div class="p-2 sm:p-3 border rounded-lg sm:rounded-xl flex items-center gap-3 hover:bg-muted/30 transition-colors">
                                      <img src="${char.node.image.large}" alt="${char.node.name.full}" class="w-10 h-10 sm:w-12 sm:h-12 rounded-md sm:rounded-lg object-cover">
                                      <div class="flex-1 min-w-0">
                                          <h4 class="text-[10px] sm:text-xs font-bold truncate">${char.node.name.full}</h4>
                                          <p class="text-[8px] sm:text-[10px] text-muted-foreground font-medium uppercase">${char.role}</p>
                                      </div>
                                  </div>
                              `
                                )
                                .join("")}
                          </div>
                      </div>
                      `
                          : ""
                      }
                      
                      ${
                        relatedAnime.length > 0
                          ? `
                      <div id="related" class="tab-pane hidden">
                          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              ${relatedAnime
                                .map(
                                  (rel) => `
                                  <div class="cn-card group cursor-pointer" onclick="showAnimeDetails(${
                                    rel.node.id
                                  })">
                                      <div class="relative overflow-hidden aspect-[3/4]">
                                          <img src="${
                                            rel.node.coverImage.large
                                          }" alt="${
                                    rel.node.title.english ||
                                    rel.node.title.romaji
                                  }" class="w-full h-full object-cover card-image-zoom">
                                      </div>
                                      <div class="p-2 sm:p-3">
                                          <p class="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase mb-0.5 sm:mb-1">${
                                            rel.relationType
                                          }</p>
                                          <h4 class="text-[10px] sm:text-xs font-bold line-clamp-1 group-hover:text-primary">${
                                            rel.node.title.english ||
                                            rel.node.title.romaji
                                          }</h4>
                                      </div>
                                  </div>
                              `
                                )
                                .join("")}
                          </div>
                      </div>
                      `
                          : ""
                      }
                      
                      ${
                        streamingLinks.length > 0 || anime.trailer
                          ? `
                      <div id="watch" class="tab-pane hidden space-y-8">
                          ${
                            anime.trailer && anime.trailer.site === "youtube"
                              ? `
                          <div class="space-y-3">
                              <h3 class="text-sm font-bold uppercase tracking-widest text-muted-foreground">Trailer</h3>
                              <div class="aspect-video rounded-2xl overflow-hidden border">
                                  <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${anime.trailer.id}" frameborder="0" allowfullscreen></iframe>
                              </div>
                          </div>
                          `
                              : ""
                          }
                          
                          ${
                            streamingLinks.length > 0
                              ? `
                          <div class="space-y-3">
                              <h3 class="text-sm font-bold uppercase tracking-widest text-muted-foreground">Watch Now</h3>
                              <div class="grid sm:grid-cols-2 gap-3">
                                  ${streamingLinks
                                    .map(
                                      (link) => `
                                      <a href="${link.url}" target="_blank" class="cn-button cn-button-outline h-12 flex items-center justify-between group hover:border-primary">
                                          <span class="font-bold text-xs uppercase tracking-widest group-hover:text-primary transition-colors">${link.site}</span>
                                          <i class="iconoir-open-new-window text-base opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all"></i>
                                      </a>
                                  `
                                    )
                                    .join("")}
                              </div>
                          </div>
                          `
                              : ""
                          }
                      </div>
                      `
                          : ""
                      }
                  </div>
              </div>
          </div>
      `;
}

function switchModalTab(button, tabId) {
  button.parentElement.querySelectorAll(".cn-tabs-trigger").forEach((tab) => {
    tab.classList.remove("active");
  });
  button.classList.add("active");

  document.querySelectorAll(".tab-pane").forEach((pane) => {
    pane.classList.add("hidden");
  });
  document.getElementById(tabId).classList.remove("hidden");
}

function getTimeUntil(timestamp) {
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}

function closeModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById("modal").classList.add("hidden");
}

function setActiveTab(button, loadFunction) {
  button.parentElement.querySelectorAll(".cn-tabs-trigger").forEach((btn) => {
    btn.classList.remove("active");
  });
  button.classList.add("active");
  loadFunction();
}

const portraitSearchBtn = document.getElementById("portraitSearchBtn");
const portraitHomeBtn = document.getElementById("portraitHomeBtn");

if (portraitSearchBtn) {
  portraitSearchBtn.addEventListener("click", () => {
    switchPortraitTab("search");
  });
}

if (portraitHomeBtn) {
  portraitHomeBtn.addEventListener("click", () => {
    switchPortraitTab("home");
  });
}
