// English UI strings — base dictionary. Add new languages as separate files.
export const en = {
  // App / shell
  "app.name": "Nyaya Sakhi",
  "app.tagline": "सत्य · साहस · सुरक्षा",
  "nav.dashboard": "Dashboard",
  "nav.chat": "Ask a Question",
  "nav.rights": "Know Your Rights",
  "nav.schemes": "Government Schemes",
  "nav.drafter": "Complaint & Application",
  "nav.legalAid": "Legal Aid",
  "nav.emergency": "Emergency",
  "nav.history": "My History",
  "nav.profile": "My Profile",
  "nav.admin": "Admin",
  "nav.menu": "Menu",
  "nav.home": "Home",
  "shell.emergency": "Emergency",
  "shell.language": "Language",
  "shell.signOut": "Sign out",
  "shell.openMenu": "Open navigation menu",
  "shell.closeMenu": "Close navigation menu",
  "shell.profileMenu": "Account menu",

  // Common
  "common.loading": "Loading…",
  "common.save": "Save",
  "common.saved": "Saved",
  "common.saving": "Saving…",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.close": "Close",
  "common.search": "Search",
  "common.retry": "Try again",
  "common.back": "Back",
  "common.next": "Next",
  "common.previous": "Previous",
  "common.download": "Download",
  "common.copy": "Copy",
  "common.copied": "Copied",
  "common.confirm": "Confirm",
  "common.optional": "optional",
  "common.required": "required",
  "common.yes": "Yes",
  "common.no": "No",
  "common.errorGeneric": "Something went wrong. Please try again.",

  // Backend states
  "backend.notConfiguredTitle": "Nyaya Sakhi backend is not configured",
  "backend.notConfiguredBody":
    "This feature talks to the Nyaya Sakhi backend, which is not configured in this environment. Ask the person running this app to set VITE_API_BASE_URL to the backend address (see backend/README.md) and restart. No demo or fabricated data is shown in the meantime.",

  // Dashboard
  "dashboard.greeting": "Namaste,",
  "dashboard.subtitle":
    "What would you like to do today? Start with the assistant, or use a guide below — everything is written in simple language.",
  "dashboard.recentQuestions": "Recent questions",
  "dashboard.newQuestion": "New question",
  "dashboard.noQuestions":
    "No questions yet. Open the AI Legal Assistant and ask your first question — it answers only from verified Indian Acts, with citations.",
  "dashboard.emergencyStrip":
    "In danger right now? Call 112 (national emergency) or 1091 (women's helpline).",
  "dashboard.allHelplines": "All helplines",
  "dashboard.disclaimer":
    "Remember: Nyaya Sakhi provides legal information, not legal advice. For advice on your specific case, consult NALSA, your State Legal Services Authority or a qualified lawyer. In an emergency, use the helplines above.",
  "dashboard.adminArea": "Admin area",

  // Chat
  "chat.title": "AI Legal Assistant",
  "chat.placeholder": "Describe your legal concern in your own words…",
  "chat.send": "Ask",
  "chat.suggested": "You could ask",
  "chat.thinking": "Checking verified legal sources…",
  "chat.mic": "Speak your question",
  "chat.micUnsupported":
    "Voice input is not supported in this browser. You can type your question instead.",
  "chat.readAloud": "Read aloud",
  "chat.stopReading": "Stop reading",
  "chat.ttsUnavailable":
    "Read-aloud service is not configured on this server yet. Your browser's built-in voice was used where available.",
  "chat.copyAnswer": "Copy answer",
  "chat.newConversation": "New conversation",
  "chat.conversations": "Conversations",
  "chat.deleteConversation": "Delete this conversation",
  "chat.emptyThread": "Start the conversation by describing your legal concern.",
  "chat.refusalTitle": "Couldn't answer from verified sources",
  "chat.disclaimer":
    "For legal literacy, not professional legal advice. Please verify with NALSA, your State Legal Services Authority or a qualified lawyer.",
  "chat.demoBadge": "Demo content — not official law",
  "chat.actSection": "Act & Section",
  "chat.source": "Source",
  "chat.nextSteps": "What you can do next",
  "chat.language": "Answer language",

  // Rights
  "rights.title": "Know Your Rights",
  "rights.subtitle": "Browse verified Indian Acts and what they mean in plain language.",
  "rights.searchPlaceholder": "Search Acts…",
  "rights.allCategories": "All categories",
  "rights.noActs": "No approved Acts are available yet. An administrator must upload and approve legal documents first.",
  "rights.provisions": "Provisions",
  "rights.noProvisions": "No provisions have been extracted for this document yet.",
  "rights.plainExplanation": "In plain language",
  "rights.save": "Save to my items",
  "rights.savedItem": "Saved to My History",
  "rights.originalText": "Original text",
  "rights.demoBadge": "Demo — not official law",

  // Schemes
  "schemes.title": "Government Schemes",
  "schemes.subtitle": "Explore welfare schemes for women and check your eligibility.",
  "schemes.searchPlaceholder": "Search schemes…",
  "schemes.allLevels": "Central & State",
  "schemes.central": "Central",
  "schemes.state": "State",
  "schemes.eligibilityTitle": "Check your eligibility",
  "schemes.eligibilityIntro":
    "Answer eight simple questions. This is a rule-based check against each scheme's published eligibility — it never guarantees eligibility. Always confirm on the official website.",
  "schemes.seeResults": "See results",
  "schemes.bucket.potentially_eligible": "You may be eligible",
  "schemes.bucket.needs_verification": "Needs checking",
  "schemes.bucket.not_matching": "Does not match",
  "schemes.eligibilityDisclaimer":
    "This is only an indication based on the answers you gave. It is not an eligibility decision. Verify on the official scheme page before you apply.",
  "schemes.noSchemes": "No schemes are available yet. An administrator can add scheme data in the Admin area.",
  "schemes.benefits": "Benefits",
  "schemes.documents": "Documents needed",
  "schemes.process": "How to apply",
  "schemes.officialPage": "Official page",
  "schemes.lastVerified": "Last verified",
  "schemes.eligibilityRules": "Published eligibility",
  "schemes.allStates": "All states",

  // Drafter
  "drafter.title": "Complaint & Application Helper",
  "drafter.reviewBanner":
    "Review before submitting. Nyaya Sakhi never submits anything for you.",
  "drafter.chooseTemplate": "Choose a document type",
  "drafter.details": "Incident / application details",
  "drafter.personal": "Your details & recipient",
  "drafter.languageStep": "Language",
  "drafter.generate": "Generate draft",
  "drafter.editDraft": "Review and edit your draft",
  "drafter.downloadPdf": "Download PDF",
  "drafter.saveDraft": "Save to my account",
  "drafter.saved": "Draft saved to My History",
  "drafter.regenerate": "Regenerate",
  "drafter.templatesUnavailable":
    "Drafter templates come from the backend, which is not configured in this environment.",
  "drafter.step": "Step",

  // Legal aid
  "legalAid.title": "Legal Aid & Support",
  "legalAid.subtitle": "Official legal services authorities only — never invented contacts.",
  "legalAid.freeGuidanceTitle": "You may be entitled to free legal aid",
  "legalAid.freeGuidanceBody":
    "Under India's legal services framework, women are among the categories entitled to free legal aid. Contact NALSA or your State / District Legal Services Authority to apply. Use the official portal (nalsa.gov.in) to locate your District Legal Services Authority.",
  "legalAid.national": "National",
  "legalAid.state": "State",
  "legalAid.district": "District",
  "legalAid.allStates": "All states",
  "legalAid.empty": "No authorities listed yet for this filter. Administrators add verified official contacts only — none are invented.",
  "legalAid.officialLocator": "Open the official NALSA portal",
  "legalAid.verified": "Verified",
  "legalAid.demoBadge": "Demo entry — development data",

  // Emergency
  "emergency.title": "Emergency Help",
  "emergency.subtitle":
    "Verified national helplines. This page is kept separate from the chatbot — in an emergency, call directly. Tap a number to dial.",

  // History
  "history.title": "My History",
  "history.tab.conversations": "Conversations",
  "history.tab.saved": "Saved items",
  "history.tab.drafts": "Drafts",
  "history.deleteOne": "Delete",
  "history.deleteAll": "Delete all",
  "history.confirmDeleteAll":
    "Delete everything in this list? This cannot be undone.",
  "history.confirmDeleteOne": "Delete this item? This cannot be undone.",
  "history.emptyConversations": "No conversations yet.",
  "history.emptySaved": "Nothing saved yet. Save Acts or schemes from their pages.",
  "history.emptyDrafts": "No saved drafts yet. Create one in the Complaint & Application Helper.",

  // Profile
  "profile.title": "My Profile",
  "profile.name": "Your name",
  "profile.email": "Email",
  "profile.language": "Preferred language",
  "profile.changePassword": "Change password",
  "profile.currentPassword": "Current password",
  "profile.newPassword": "New password",
  "profile.passwordUpdated": "Password updated.",
  "profile.deleteData": "Delete all my data",
  "profile.deleteDataWarning":
    "This permanently deletes your conversations, drafts and saved items. It cannot be undone. Your account itself is not deleted.",
  "profile.dataDeleted": "All your data was deleted.",
  "profile.saveProfile": "Save profile",
  "profile.profileSaved": "Profile saved.",

  // Admin
  "admin.title": "Admin",
  "admin.tab.documents": "Documents",
  "admin.tab.schemes": "Schemes",
  "admin.tab.emergency": "Emergency",
  "admin.tab.legalAid": "Legal aid",
  "admin.tab.stats": "Usage stats",
  "admin.upload": "Upload document",
  "admin.uploadHint":
    "PDF/TXT of an official Act. Documents stay 'pending' until you verify the extracted text against the official source and approve them. Only approved documents reach the chatbot.",
  "admin.process": "Process & embed",
  "admin.approve": "Approve",
  "admin.reject": "Reject",
  "admin.replaceVersion": "Replace version",
  "admin.verified": "Verified",
  "admin.markVerified": "Mark verified",
  "admin.add": "Add",
  "admin.statsTitle": "Usage statistics",
  "admin.notAdmin": "You need an administrator role to open this page.",

  // Errors / states
  "error.backendUnreachable": "Backend not configured or unreachable.",
  "error.setupHint": "See backend/README.md to start the Nyaya Sakhi backend and set VITE_API_BASE_URL.",
} as const;

export type TranslationKey = keyof typeof en;
