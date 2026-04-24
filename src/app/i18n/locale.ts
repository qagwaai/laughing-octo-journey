/**
 * Central application locale catalog (English).
 * All UI strings for every page live here — one source of truth.
 * To add a new language, export a second object with the same shape and
 * swap it in at the injection point.
 *
 * Strings are grouped by page section. Narrative / game-content copy that
 * has multiple variants lives in src/app/model/opening-sequence.locale.ts.
 */
export const locale = {
	common: {
		yes: 'Yes',
		no: 'No',
		cancel: 'Cancel',
		playerPrefix: 'Player:',
		characterPrefix: 'Character:',
		levelPrefix: 'Level',
		loggedInAsPrefix: 'Logged in as:',
		loading: 'Loading...',
	},

	public: {
		intro: {
			title: 'Stellar',
			welcome: 'Welcome to Project Stellar',
			welcomeBody:
				'Welcome, Pioneer. You begin your journey on the ragged edge of a silent asteroid belt, equipped with nothing but a basic Extruder Tool and the ambition to dominate the vacuum. Project Stellar is a deep-industrial simulation that tracks your evolution from a lone scavenger to the architect of a system-wide autonomous empire.',
			coreGameplayTitle: 'Core Gameplay Mechanics',
			coreGameplayBody:
				'The heartbeat of Stellar is the Industrial Loop: a multi-tiered crafting system that demands strategic resource management and precise logistical planning.',
			scavengeTitle: 'Scavenge & Extract',
			scavengeBody:
				'Your journey starts with raw ores—Iron, Copper, and Carbon. Use your manual tools to gather the seeds of your empire.',
			refineTitle: 'Refine & Forge',
			refineBody:
				'Raw ore is inefficient. You must build Induction Forges to cast Ingots and Extruders to pull Copper Wiring. Quality matters; a chassis built from Steel Plating will outlast raw Iron ten-to-one.',
			chemicalTitle: 'Chemical & Thermal Mastery',
			chemicalBody:
				'Space is cold, but industry is hot. You will manage volatile fluids like Hydrazine in Chemical Mixers and install Heat Sinks to prevent your advanced processors from melting under the strain of deep-space operations.',
			logisticsTitle: 'Automated Logistics',
			logisticsBody:
				"You aren't meant to work alone. Craft Logic Chips and Sensor Arrays to breathe life into your drone fleet. From the humble Scavenger Dart to the massive Heavy Hauler, your drones do the work while you design the systems.",
			progressionTitle: 'Player Progression: From Scavenger to Architect',
			progressionBody:
				'Your progression is measured across 50 Levels of Technological Breakthroughs, divided into three distinct eras:',
			industrialAge: 'The Industrial Age (Levels 1–15)',
			industrialAgeBody:
				'Mastering the basics of metallurgy and mechanical assembly. You will focus on building your first Arc Welder and establishing a steady supply of Solid Fuel Pellets to keep your early base powered.',
			precisionAge: 'The Precision Age (Levels 16–35)',
			precisionAgeBody:
				'Transitioning into micro-engineering. You will utilize Lithography Kits and Silver Contacts to create high-tier AI. At this stage, you stop managing individual drones and start managing Relay Hubs that coordinate entire wings of automated workers.',
			atomicAge: 'The Atomic Age (Levels 36–50)',
			atomicAgeBody:
				'Manipulating matter at its most fundamental level. Using Atomic Layerers and Synthesis Engines, you will harness exotic materials like Rhodium and Unobtainium to power Fusion Reactors and reach the pinnacle of engineering.',
			endgameTitle: 'The Endgame: The Hive-Mind',
			endgameBody1:
				'The ultimate goal of Project Stellar is the transition from Manual Control to Total Autonomy.',
			endgameBody2:
				'Upon reaching Level 50, you will unlock the blueprint for The Hive-Mind. This is not just a ship or a building; it is a capital asset that links every drone, relay, and refinery in your empire into a single, sentient network.',
			endgameBody3:
				"With the Warp Drive online and the Quantum Matrix processing billions of calculations per second, you will no longer be a mere pilot in the belt—you will be the intelligence that commands the stars. The galaxy is a resource; it's time to harvest it.",
			quote: 'The stars are not just lights in the sky; they are the fuel for the next evolution.',
			registerLink: 'New Users Register here',
			loginLink: 'Existing Users Login here',
		},

		login: {
			title: 'Login',
			subtitle: 'Welcome back, Pioneer. Enter your credentials to continue.',
			playerNameLabel: 'Player Name',
			playerNamePlaceholder: 'Your callsign',
			passwordLabel: 'Password',
			passwordPlaceholder: 'Your password',
			submitLabel: 'Login',
			submittingLabel: 'Logging in...',
			registerLink: 'Need an account? Register here.',
			playerNotFoundLink: 'Player not found. Register here.',
			errors: {
				playerNameRequired: 'Player name is required.',
				playerNameMinLength: 'Must be at least 3 characters.',
				passwordRequired: 'Password is required.',
				passwordMinLength: 'Must be at least 8 characters.',
			},
		},

		registration: {
			title: 'Register',
			subtitle: 'Create your Pioneer account to join Project Stellar',
			playerNameLabel: 'Player Name',
			playerNamePlaceholder: 'Choose your callsign',
			emailLabel: 'Email',
			emailPlaceholder: 'your@email.com',
			passwordLabel: 'Password',
			passwordPlaceholder: 'Min. 8 characters',
			confirmPasswordLabel: 'Confirm Password',
			confirmPasswordPlaceholder: 'Repeat your password',
			submitLabel: 'Register',
			submittingLabel: 'Registering...',
			loginLink: 'Already registered? Login here.',
			errors: {
				playerNameRequired: 'Player name is required.',
				playerNameMinLength: 'Must be at least 3 characters.',
				playerNameMaxLength: 'Must be 20 characters or fewer.',
				emailRequired: 'Email is required.',
				emailInvalid: 'Must be a valid email address.',
				passwordRequired: 'Password is required.',
				passwordMinLength: 'Must be at least 8 characters.',
				passwordMismatch: 'Passwords do not match.',
			},
		},
	},

	character: {
		list: {
			title: 'Character List',
			subtitle: 'Review characters created for your player profile.',
			loadLabel: 'Load Characters',
			loadingLabel: 'Loading...',
			setupLabel: 'Create / Edit Character',
			emptyState: 'No characters loaded yet.',
			joinLabel: 'Join Game',
			joinInProgressLabel: 'Join Game in Progress',
			editLabel: 'Edit',
			deleteLabel: 'Delete',
			dialog: {
				title: 'Delete Character',
				confirmQuestion: 'Are you sure you want to delete',
				confirmLabel: 'Confirm Delete',
				confirmingLabel: 'Deleting...',
				cancelLabel: 'Cancel',
			},
		},

		setup: {
			title: 'Character Setup',
			editTitle: 'Edit Character',
			subtitle: 'Finalize your pilot profile before launch.',
			editSubtitle: 'Update your pilot profile.',
			characterNameLabel: 'Character Name',
			characterNamePlaceholder: 'Enter your character name',
			submitLabel: 'Save Character',
			editSubmitLabel: 'Save Character Changes',
			submittingLabel: 'Saving Character...',
			listLabel: 'View Character List',
			errors: {
				characterNameRequired: 'Character name is required.',
				characterNameMinLength: 'Must be at least 2 characters.',
				characterNameMaxLength: 'Must be 24 characters or fewer.',
			},
		},
	},

	game: {
		join: {
			title: 'Game Join',
			subtitle: 'Preparing to join with your selected character.',
			dronesTitle: 'Drones',
			droneLoadingStatus: 'Loading drones...',
			droneEmptyStatus: 'No drones found for this character.',
			droneNameLabel: 'Name:',
			droneIdLabel: 'ID:',
			droneUnknownModel: 'Unknown Model',
			droneViewSpecsLabel: 'View Specs',
			droneKinematicsLabel: 'Kinematics:',
		},

		main: {
			title: 'Game Main',
			subtitle: 'Mission control overview for your current pilot and operation.',
			sectionTitle: 'Current Operation',
			sectionDescription:
				'Scan telemetry is active in the right panel. Use the operations menu to open profile, hangar, and market modules while keeping the scan feed live.',
		},

		logout: {
			title: 'Logout',
			subtitle: 'Exit your current authenticated session.',
			sectionTitle: 'Sign Out',
			sectionDescription: 'Use this sample page action to clear the session and return to login.',
			confirmLabel: 'Confirm Logout',
		},

		stellarInitiation: {
			title: 'Stellar Initiation',
			subtitle: 'Mission onboarding, flight checks, and launch readiness.',
			sectionTitle: 'Checklist',
			sectionDescription:
				'Sample module: run diagnostics, validate credentials, and confirm launch corridor assignment.',
		},

		repairRetrofit: {
			title: 'Repair & Retrofit',
			subtitle: 'Maintenance bay work orders and hardware upgrade planning.',
			sectionTitle: 'Service Queue',
			sectionDescription:
				'Sample module: review damaged components, estimated repair windows, and retrofit options.',
		},

		marketHub: {
			title: 'Market Hub',
			subtitle: 'Exchange terminal for equipment bids, contracts, and resource trading.',
			sectionTitle: 'Trade Board',
			sectionDescription: 'Sample module: browse listings, evaluate prices, and prepare purchase orders.',
		},

		droneHangar: {
			title: 'Drone Hangar',
			subtitle: 'Fleet roster, deployment readiness, and drone assignment queue.',
			sectionTitle: 'Hangar Board',
			sectionDescription:
				'Sample module: list docked drones, sortie status, and launch bay reservations.',
		},

		fabricationLab: {
			title: 'Fabrication Lab',
			subtitle: 'Blueprint management and component manufacturing pipeline.',
			sectionTitle: 'Build Queue',
			sectionDescription:
				'Sample module: schedule production runs and inspect fabrication output quality.',
		},

		characterProfile: {
			title: 'Character Profile',
			subtitle: 'Identity records, progression milestones, and mission reputation.',
			sectionTitle: 'Profile Snapshot',
			sectionDescription:
				'Sample module: display rank history, specialization badges, and current assignment.',
		},
	},

	opening: {
		coldBoot: {
			bootStageLabel: 'Boot Stage',
			startScanningDescription:
				'Start scanning the nearby region for raw materials to use in printing a Fabrication Unit?',
			startScanningLabel: 'Start Scanning?',
			startScanningPendingLabel: 'Starting Scan...',
			startScanningErrorLabel: 'Scanning handoff failed. Retry after comms stabilize.',
			enableAudioHooksLabel: 'Enable Audio Hooks',
			disableAudioHooksLabel: 'Disable Audio Hooks',
			audioStatusTitle: 'Audio Status',
			armedLabel: 'Armed',
			bedLabel: 'Bed',
			speechLabel: 'Speech',
			yesLabel: 'Yes',
			noLabel: 'No',
			runningLabel: 'Running',
			stoppedLabel: 'Stopped',
			availableLabel: 'Available',
			unavailableLabel: 'Unavailable',
			armedTooltipOn: 'Audio is armed and can play cinematic layers.',
			armedTooltipOff:
				'Audio is disabled. Click Enable Audio Hooks (or first pointer/key gesture) to unlock playback.',
			bedTooltipDisarmed: 'Bed is stopped because audio is not armed yet.',
			bedTooltipStopped:
				'Bed is stopped. Re-enter this sequence or re-arm audio to start the loop again.',
			bedTooltipRunning: 'Bed loop is currently running.',
			speechTooltipAvailable: 'Speech synthesis is available for AI transmissions.',
			speechTooltipUnavailable:
				'Speech synthesis is unavailable in this browser or current environment.',
		},
	},
} as const;

export type AppLocale = typeof locale;
