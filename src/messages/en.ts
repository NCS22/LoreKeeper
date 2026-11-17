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
    loadingUniverses: "Loading your universes",
  },
  sidebar: {
    treeLabel: "Your universes",
    railUniverses: "Universes",
    newUniverse: "New universe",
    worksHeading: "Works",
    noWorks: "No works yet",
  },
  center: {
    viewSwitcherLabel: "View",
    graphView: "Graph",
    listView: "List",
  },
  graph: {
    emptyText:
      "The graph will show the entities of this universe and the relationships between them. There is nothing to draw yet.",
    legendTitle: "Legend",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fitToView: "Fit graph to view",
    canvasLabel: (entityCount: number, relationshipCount: number) =>
      `Knowledge graph with ${entityCount} entities and ${relationshipCount} relationships. The list view shows the same content as text.`,
  },
  entityList: {
    emptyText: "The list will show the entities of this universe, grouped by type. There are no entities yet.",
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
  statuses: {
    CONFIRMED: "Confirmed",
    USER_NOTE: "Note",
    SPECULATION: "Speculation",
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
    // Messages of the creation request itself, shown in the form (never an error detail).
    notices: {
      failed: "The universe could not be created. Your entries are kept; you can try again.",
      resultUnknown:
        "We could not confirm whether the universe was created. It may exist already: check the list of universes before trying again.",
      confirmedAfterDelay: "The universe was created after all and is now selected.",
      signInAgain: "Your session has ended, so nothing was created. Your entries are kept: sign in again to continue.",
      signInLink: "Sign in",
      dismiss: "Dismiss",
    },
    // Validation messages, keyed by the stable issue code. The limits come from the issue details.
    issues: {
      NAME_REQUIRED: "Enter a name for the universe.",
      NAME_TOO_LONG: (maximumLength: number) => `The name can have at most ${maximumLength} characters.`,
      NAME_INVALID_CHARACTERS: "The name contains characters that cannot be stored.",
      DESCRIPTION_TOO_LONG: (maximumLength: number) =>
        `The description can have at most ${maximumLength} characters.`,
      DESCRIPTION_INVALID_CHARACTERS: "The description contains characters that cannot be stored.",
      MODE_INVALID: "Choose Reader or Author mode.",
      UNKNOWN: "This value is not valid.",
    },
  },
  // Shown while the account has no universe (FR-16). It does not name a panel: on a narrow screen the
  // universes are in a drawer.
  noUniversesEmptyState: {
    title: "You have no universes yet",
    text: "A universe is the knowledge base of one fictional world. Create your first one to start.",
    createFirstUniverse: "Create your first universe",
  },
  universeEmptyState: {
    modeLabel: "Mode:",
    emptyText: "This universe is empty. Works, entities and relationships arrive in future versions.",
    createdAnnouncement: (universeName: string) => `Universe created: ${universeName}`,
  },
  inspector: {
    emptyTitle: "Nothing to show yet",
    emptyText: "Knowledge, relationships, events, sources and reading positions arrive in future versions.",
    noKnowledge: "No knowledge has been added yet.",
    revealedAt: "Revealed at",
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
  // The user menu of the top bar (FR-25, FR-26). The sign-out texts are in `accountForms.signOut`.
  userMenu: {
    triggerLabel: "Account menu",
    panelTitle: "Account",
    displayNameLabel: "Display name",
    emailLabel: "Email",
  },
  // The page shown when the session of a request cannot be checked (FR-24). It says nothing about
  // the person's session or account, because it is unknown.
  sessionCheckFailed: {
    title: "We could not check your session",
    description: "Something went wrong on our side. Your session has not been closed. Try again in a moment.",
    tryAgain: "Try again",
    metadataTitle: "Something went wrong",
  },
  // The page shown to a signed-in person who asks for an address that does not exist (FR-23).
  notFound: {
    metadataTitle: "Page not found",
    title: "We could not find that page",
    description: "That address does not exist, or it may have moved. Go back to the workspace to keep working.",
    backToWorkspace: "Back to the workspace",
  },
  // The page shown when rendering a page fails after the session was admitted (FR-24). It never
  // shows the error itself and says nothing about the person's session, because it is unknown.
  errorPage: {
    title: "Something went wrong",
    description: "This page could not be shown. Nothing was changed. Try again in a moment.",
    tryAgain: "Try again",
  },
} as const;

export type Messages = typeof en;
