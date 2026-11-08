/*
 * Typed UI dictionary. Every user-facing string lives here so other languages can be added later
 * by providing another object of type `Messages`. No i18n library is involved.
 */
export const en = {
  app: {
    name: "LoreKeeper",
    tagline: "A knowledge base for the worlds you read.",
  },
  workspace: {
    skipToContent: "Skip to content",
    sidebarLabel: "Universes",
    mainLabel: "Workspace",
    inspectorLabel: "Details",
    collapseSidebar: "Collapse sidebar",
    expandSidebar: "Expand sidebar",
    openSidebar: "Open universes",
    detailsPanel: "Details panel",
    collapseInspector: "Close details panel",
    resizeSidebar: "Resize sidebar",
    resizeInspector: "Resize details panel",
  },
  sidebar: {
    treeLabel: "Universes and works",
    railUniverses: "Universes",
    railWorks: "Works in the selected universe",
    newUniverse: "New universe",
  },
  center: {
    viewSwitcherLabel: "View",
    graphView: "Graph",
    listView: "List",
    newElement: "New element",
  },
  graph: {
    loading: "Loading graph...",
    legendTitle: "Legend",
    switchToList: "Skip the graph and open the list view",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fitToView: "Fit graph to view",
    canvasLabel: (entityCount: number, relationshipCount: number) =>
      `Knowledge graph with ${entityCount} entities and ${relationshipCount} relationships. The list view shows the same content as text.`,
  },
  entityList: {
    empty: "Nothing here yet. Use New element to add the first entity.",
  },
  entityTypes: {
    CHARACTER: "Character",
    LOCATION: "Location",
    ORGANIZATION: "Organization",
    FACTION: "Faction",
    OBJECT: "Object",
    ABILITY: "Ability",
    SPECIES: "Species",
    CONCEPT: "Concept",
  },
  entityTypePlural: {
    CHARACTER: "Characters",
    LOCATION: "Locations",
    ORGANIZATION: "Organizations",
    FACTION: "Factions",
    OBJECT: "Objects",
    ABILITY: "Abilities",
    SPECIES: "Species",
    CONCEPT: "Concepts",
  },
  statuses: {
    CONFIRMED: "Confirmed",
    USER_NOTE: "Note",
    SPECULATION: "Speculation",
  },
  creation: {
    title: "New element",
    typeLabel: "Type",
    typePlaceholder: "Choose a type",
    nameLabel: "Name",
    namePlaceholder: "The name it is introduced under",
    introductionLegend: "Introduction point",
    introductionHelp: "Where in a work this entity first appears.",
    workLabel: "Work",
    workPlaceholder: "Choose a work",
    unitPlaceholder: "Choose a position",
    unitKinds: { CHAPTER: "Chapter", EPISODE: "Episode", OTHER: "Position" },
    fragmentLabel: "First fragment of knowledge",
    fragmentHelp: "What is known at this point. Anything learned later becomes a new fragment.",
    statusLegend: "Status",
    statusDescriptions: {
      CONFIRMED: "Stated by the work",
      USER_NOTE: "Your own annotation",
      SPECULATION: "A theory the work has not confirmed",
    },
    cancel: "Cancel",
    save: "Save",
    notImplemented: "Saving is not implemented yet. This form only shows the design.",
  },
  universeCreation: {
    title: "New universe",
    nameLabel: "Name",
    namePlaceholder: "The name of the world",
    descriptionLabel: "Description",
    descriptionOptionalHint: "Optional",
    descriptionPlaceholder: "What this universe is about",
    modeLegend: "Mode",
    modes: {
      READER: {
        label: "Reader",
        explanation: "Protects you from spoilers: you only see what you have read so far.",
      },
      AUTHOR: {
        label: "Author",
        explanation: "Shows everything, while still recording boundaries for chronology.",
      },
    },
    modeImmutableNote: "The mode cannot be changed after the universe is created.",
    duplicateNameWarning: "A universe with this name already exists. You can still create this one.",
    cancel: "Cancel",
    create: "Create universe",
    // Validation messages, keyed by the stable issue code. The limits come from the issue details.
    issues: {
      NAME_REQUIRED: "Enter a name for the universe.",
      NAME_TOO_LONG: (maximumLength: number) => `The name can have at most ${maximumLength} characters.`,
      DESCRIPTION_TOO_LONG: (maximumLength: number) =>
        `The description can have at most ${maximumLength} characters.`,
      MODE_INVALID: "Choose Reader or Author mode.",
      UNKNOWN: "This value is not valid.",
    },
  },
  universeEmptyState: {
    noContentYet: "This universe has no content yet.",
    nextStepsHint: "Its works and entities will appear here once they are added.",
    createdAnnouncement: (universeName: string) => `Universe created: ${universeName}`,
  },
  inspector: {
    emptyTitle: "Nothing selected",
    emptyText: "Choose an entity in the graph or the list to read what is known about it.",
    introducedAt: "Introduced at",
    aliasesLead: "Also known as",
    knowledgeTitle: "Knowledge",
    revealedAt: "Revealed at",
    relationshipsTitle: "Relationships",
    eventsTitle: "Events",
    sourcesTitle: "Sources",
    noKnowledge: "No knowledge has been added yet.",
    eventRoles: {
      PROTAGONIST: "Protagonist",
      PARTICIPANT: "Participant",
      AFFECTED: "Affected",
      LOCATION: "Location",
      MENTIONED: "Mentioned",
    },
  },
  media: {
    NOVEL: "Novel",
    MANGA: "Manga",
    COMIC: "Comic",
    ANIME: "Anime",
    TV_SERIES: "TV series",
    FILM: "Film",
    OTHER: "Other",
  },
  menus: {
    label: "Application menu",
    unavailable: "Not available in this prototype",
    universe: {
      label: "Universe",
      // The only enabled entry of the Universe menu; the items below stay disabled placeholders.
      newUniverse: "New universe",
      items: ["Rename universe", "Switch mode", "Move to trash"],
    },
    view: {
      label: "View",
      items: ["Show sidebar", "Show details panel", "Zoom to fit", "Open timeline"],
    },
    help: {
      label: "Help",
      items: ["Keyboard shortcuts", "Documentation", "About LoreKeeper"],
    },
  },
  accessibility: {
    triggerLabel: "Accessibility",
    title: "Accessibility",
    backgroundLegend: "Background",
    textLegend: "Text color",
    textSizeLabel: "Text size",
    reset: "Reset to defaults",
    lowContrast: "Unavailable: the text would be hard to read.",
    unavailableHint: "Some options are unavailable because the text would be hard to read.",
    backgroundPresets: {
      obsidian: "Obsidian",
      midnight: "Midnight",
      nocturne: "Nocturne",
      parchment: "Parchment",
    },
    textPresets: {
      vellum: "Vellum",
      ash: "Ash",
      bright: "Bright",
    },
  },
  accountForms: {
    signUp: {
      title: "Create your account",
      displayNameLabel: "Display name",
      emailLabel: "Email",
      passwordLabel: "Password",
      repeatPasswordLabel: "Repeat password",
      submit: "Create account",
      submitting: "Creating account...",
      switchPrompt: "Already have an account?",
      switchLink: "Sign in",
      // The result is unknown: the account may exist, so the person is pointed to sign-in (FR-10).
      resultUnknown:
        "We could not confirm the result. If you already created your account, try signing in.",
      // The account was created but the browser did not keep the session (FR-14).
      storageBlocked:
        "Your account was created, but this site needs to store data in your browser to keep you signed in. Allow it in your browser settings, then sign in.",
    },
    signIn: {
      title: "Sign in",
      emailLabel: "Email",
      passwordLabel: "Password",
      submit: "Sign in",
      submitting: "Signing in...",
      switchPrompt: "New to LoreKeeper?",
      switchLink: "Create an account",
      credentialsIncorrect: "Email or password incorrect.",
      resultUnknown:
        "We could not reach the application or confirm the result. Check your connection and try again.",
      storageBlocked:
        "This site needs to store data in your browser to keep you signed in. Allow it in your browser settings and try again.",
    },
    signOut: {
      submit: "Sign out",
      submitting: "Signing out...",
      resultUnknown:
        "We could not confirm that you signed out. Your session may still be open. Try again.",
    },
    generalFailure: "Something went wrong. Try again.",
    emailAlreadyRegistered: "An account with this email already exists.",
    // Validation messages, keyed by the meaning of the stable issue code. Limits come from the issue details.
    issues: {
      displayNameRequired: "Enter a display name.",
      displayNameTooLong: (maximumLength: number) =>
        `The display name can have at most ${maximumLength} characters.`,
      displayNameInvalidCharacters:
        "The display name cannot contain line breaks or other control characters.",
      emailInvalid: "Enter a valid email address.",
      emailRequired: "Enter your email.",
      passwordLength: (minimumLength: number, maximumLength: number) =>
        `The password must have between ${minimumLength} and ${maximumLength} characters.`,
      passwordRequired: "Enter your password.",
      repeatPasswordMismatch: "The passwords do not match.",
      unknown: "This value is not valid.",
    },
  },
} as const;

export type Messages = typeof en;
