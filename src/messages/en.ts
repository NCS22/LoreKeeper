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
      "The graph will draw the entities of this universe and the relationships between them in a future version. The list view shows the entities.",
  },
  // The entity list of the central area (spec 006, FR-9).
  entityList: {
    heading: "Entities",
    loading: "Loading the entities",
    loadFailed: "The entities could not be loaded.",
    noEntities: "This universe has no entities yet.",
    workNeededFirst: "Add a work first: every entity is introduced at a point of a work.",
    addWork: "Add work",
    newEntity: "New entity",
  },
  // The choice of a point of a work in the knowledge forms (spec 006, FR-4): a work and a unit number.
  unitPicker: {
    workLabel: "Work",
    workOption: (workTitle: string, mediumLabel: string) => `${workTitle} (${mediumLabel})`,
    // The label of the unit number field, by the unit wording of the chosen work.
    wordingLabels: { chapter: "Chapter", episode: "Episode", unit: "Unit" },
    range: (unitCount: number) => `1 to ${unitCount}`,
    first: "First",
    last: "Last",
    firstLabel: (unitWording: string) => `First ${unitWording}`,
    lastLabel: (unitWording: string) => `Last ${unitWording}`,
    resolvedPoint: (wordingLabel: string, unitNumber: number, workTitle: string) =>
      `${wordingLabel} ${unitNumber} of ${workTitle}`,
    noUnit: (unitWording: string, unitCount: number) =>
      `No ${unitWording} has this number. Type a number from 1 to ${unitCount} with digits only, or use First or Last.`,
  },
  entityCreation: {
    title: "New entity",
    nameLabel: "Name",
    namePlaceholder: "The name of the character, place, object...",
    typeLabel: "Type",
    pointLegend: "Introduced at",
    fragmentLegend: "First fragment",
    fragmentOptionalHint: "Optional",
    fragmentContentLabel: "What you know about it",
    fragmentContentHint: "Leave it empty to create the entity without a fragment.",
    statusLegend: "Status",
    statuses: {
      CONFIRMED: { label: "Confirmed", explanation: "Stated by the work." },
      USER_NOTE: { label: "My note", explanation: "Your own note or reading." },
      SPECULATION: { label: "Speculation", explanation: "A theory the work has not stated." },
    },
    samePointLabel: "Same point as the entity",
    fragmentPointLegend: "Revealed at",
    cancel: "Cancel",
    create: "Create entity",
    createdAnnouncement: (entityName: string) => `Entity created: ${entityName}`,
    // The notice of FR-6: it names the oldest entity of the same type with the same comparable name.
    similarEntityNotice: (similarEntityName: string) =>
      `A similar entity already exists: ${similarEntityName}. The new one was created as well.`,
    notices: {
      failed: "The entity could not be created. Your entries are kept; you can try again.",
      resultUnknown:
        "We could not confirm whether the entity was created. It may exist already: check the entities of this universe before trying again.",
      confirmedAfterDelay: "The entity was created after all and is now in the entities of this universe.",
      signInAgain: "Your session has ended, so nothing was created. Your entries are kept: sign in again to continue.",
      signInLink: "Sign in",
      dismiss: "Dismiss",
    },
    // Validation messages, keyed by the stable issue code. Limits come from the issue or the vocabulary.
    issues: {
      NAME_REQUIRED: "Enter a name for the entity.",
      NAME_TOO_LONG: (maximumLength: number) => `The name can have at most ${maximumLength} characters.`,
      NAME_INVALID_CHARACTERS: "The name contains characters that cannot be stored.",
      TYPE_INVALID: "Choose the type of the entity.",
      WORK_INVALID: "Choose a work of this universe.",
      UNIT_NUMBER_REQUIRED: "Choose the chapter or episode: type its number, or use First or Last.",
      UNIT_NUMBER_INVALID: "Write the number with digits only, without signs, decimals, spaces or separators.",
      CONTENT_TOO_LONG: (maximumLength: number) => `The fragment can have at most ${maximumLength} characters.`,
      CONTENT_INVALID_CHARACTERS: "The fragment contains characters that cannot be stored.",
      STATUS_INVALID: "Choose the status of the fragment.",
      UNKNOWN: "This value is not valid.",
    },
  },
  // Texts shared by the knowledge items of a universe (spec 006).
  knowledge: {
    mediums: {
      NOVEL: "Novel",
      MANGA: "Manga",
      COMIC: "Comic",
      ANIME: "Anime",
      TV_SERIES: "TV series",
      FILM: "Film",
      OTHER: "Other",
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
    // The number of units of a work with its unit wording: "1 chapter", "120 chapters".
    unitWordings: {
      chapter: { singular: "chapter", plural: "chapters" },
      episode: { singular: "episode", plural: "episodes" },
      unit: { singular: "unit", plural: "units" },
    },
    tryAgain: "Try again",
  },
  // The works area of the navigation (spec 006, FR-2).
  works: {
    addWork: "Add work",
    loading: "Loading the works",
    loadFailed: "The works could not be loaded.",
    listLabel: "Works of this universe",
  },
  workCreation: {
    title: "New work",
    titleLabel: "Title",
    titlePlaceholder: "The title of the work",
    mediumLabel: "Medium",
    unitCountLabel: "Number of units",
    unitCountHint: (maximumUnitCount: number) =>
      `How many chapters or episodes the work has, in digits, from 1 to ${maximumUnitCount}. They are numbered from 1.`,
    cancel: "Cancel",
    create: "Create work",
    createdAnnouncement: (workTitle: string) => `Work created: ${workTitle}`,
    // Messages of the creation request itself, shown in the form (never an error detail).
    notices: {
      failed: "The work could not be created. Your entries are kept; you can try again.",
      resultUnknown:
        "We could not confirm whether the work was created. It may exist already: check the works of this universe before trying again.",
      confirmedAfterDelay: "The work was created after all and is now in the works of this universe.",
      signInAgain: "Your session has ended, so nothing was created. Your entries are kept: sign in again to continue.",
      signInLink: "Sign in",
      dismiss: "Dismiss",
    },
    // Validation messages, keyed by the stable issue code. Limits come from the issue or the vocabulary.
    issues: {
      TITLE_REQUIRED: "Enter a title for the work.",
      TITLE_TOO_LONG: (maximumLength: number) => `The title can have at most ${maximumLength} characters.`,
      TITLE_INVALID_CHARACTERS: "The title contains characters that cannot be stored.",
      MEDIUM_INVALID: "Choose the medium of the work.",
      UNIT_COUNT_REQUIRED: "Enter how many chapters or episodes the work has.",
      UNIT_COUNT_INVALID: "Write the number with digits only, without signs, decimals, spaces or separators.",
      UNIT_COUNT_OUT_OF_RANGE: (maximumUnitCount: number) => `The number must be from 1 to ${maximumUnitCount}.`,
      UNKNOWN: "This value is not valid.",
    },
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
    createdAnnouncement: (universeName: string) => `Universe created: ${universeName}`,
  },
  inspector: {
    emptyTitle: "Nothing to show yet",
    // Shown under every state of the details panel: what the panel does not show yet (spec 006).
    emptyText: "Events, sources and reading positions arrive in future versions.",
  },
  // The details panel of the selected entity (spec 006, FR-10).
  entityDetails: {
    loadingUniverse: "Loading the details",
    noEntitiesTitle: "No entities yet",
    noEntitiesText: "The details of an entity are shown here once it exists. Create one in the list view.",
    selectEntityTitle: "Select an entity",
    selectEntityText: "Choose an entity in the list view to see what you know about it.",
    loading: "Loading the entity",
    loadFailed: "The details of this entity could not be loaded.",
    typeLabel: "Type",
    introducedAtLabel: "Introduced at",
    // A point of a work as the panel shows it, "Chapter 3 of The Fellowship": the title follows as isolated text.
    pointUnitOf: (wordingLabel: string, unitLabel: string) => `${wordingLabel} ${unitLabel} of`,
    firstFragmentHeading: "First fragment",
    noFragment: "No fragment yet.",
    statusLabel: "Status",
    revealedAtLabel: "Revealed at",
    relationshipsHeading: "Relationships",
    noRelationships: "No relationships yet.",
    newRelationship: "New relationship",
    // The reading of a relationship from the entity of the panel: "<subject> — <label> → <other>".
    readingConnectors: { afterSubject: " — ", afterLabel: " → " },
  },
  relationshipCreation: {
    title: "New relationship",
    // Shown instead of the form while the universe has fewer than two entities (FR-7).
    twoEntitiesNeeded: "A relationship connects two entities: create at least two entities first.",
    sourceLabel: "From",
    typeLabel: "Relationship",
    targetLabel: "To",
    entityOption: (entityName: string, typeLabel: string) => `${entityName} (${typeLabel})`,
    statusLegend: "Status",
    pointLegend: "Known at",
    cancel: "Cancel",
    create: "Create relationship",
    createdAnnouncement: (sourceName: string, label: string, targetName: string) =>
      `Relationship created: ${sourceName} — ${label} → ${targetName}`,
    notices: {
      failed: "The relationship could not be created. Your entries are kept; you can try again.",
      resultUnknown:
        "We could not confirm whether the relationship was created. It may exist already: check the details of its entities before trying again.",
      confirmedAfterDelay: "The relationship was created after all and is now in the details of its entities.",
      signInAgain: "Your session has ended, so nothing was created. Your entries are kept: sign in again to continue.",
      signInLink: "Sign in",
      dismiss: "Dismiss",
    },
    // Validation messages, keyed by the stable issue code and, for a malformed identifier, by its field.
    issues: {
      SOURCE_INVALID: "Choose the entity the relationship starts from.",
      TARGET_INVALID: "Choose the entity the relationship points to.",
      TYPE_INVALID: "Choose the type of the relationship.",
      WORK_INVALID: "Choose a work of this universe.",
      UNIT_NUMBER_REQUIRED: "Choose the chapter or episode: type its number, or use First or Last.",
      UNIT_NUMBER_INVALID: "Write the number with digits only, without signs, decimals, spaces or separators.",
      STATUS_INVALID: "Choose the status of the relationship.",
      RELATED_TO_ITSELF: "Choose another entity: a relationship cannot connect an entity with itself.",
      UNKNOWN: "This value is not valid.",
    },
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
