import React, { createContext, useContext, useEffect, useState } from 'react';
import { getLocalePreference, setLocalePreference } from './offlineVault';

export type Locale = 'en-HK' | 'zh-HK' | 'zh-CN';

export const LOCALE_OPTIONS: { code: Locale; label: string; short: string }[] = [
  { code: 'en-HK', label: 'English (HK)', short: 'EN' },
  { code: 'zh-HK', label: '繁體中文（香港）', short: '繁體' },
  { code: 'zh-CN', label: '简体中文', short: '简体' },
];

export interface TranslationDict {
  common: {
    brand: string;
    brandTag: string;
    loading: string;
    signOut: string;
    lockVault: string;
    cancel: string;
    save: string;
    delete: string;
    copy: string;
    copied: string;
    dismiss: string;
    present: string;
    living: string;
    ancestor: string;
    piiHidden: string;
    noneRecorded: string;
    allBranches: string;
    allTiers: string;
    genPrefix: string;
  };
  nav: {
    tree: string;
    ledger: string;
    chronology: string;
    roles: string;
    mfa: string;
    offline: string;
  };
  ribbon: {
    custodian: string;
    role: string;
    storage: string;
    hybridSync: string;
    offlineOnly: string;
    pendingSync: string;
    mfaVerified: string;
    passwordSession: string;
  };
  auth: {
    kicker: string;
    titleClaim: string;
    titleInvite: string;
    titleLogin: string;
    tabClaim: string;
    tabLogin: string;
    tabInvite: string;
    accessNotice: string;
    custodianEngName: string;
    chineseNameLabel: string;
    custodianEmail: string;
    custodianPassword: string;
    envPasscodeLabel: string;
    claimButton: string;
    claimingButton: string;
    memberEmail: string;
    passwordLabel: string;
    signInButton: string;
    signingInButton: string;
    inviteCodeLabel: string;
    fullNameLabel: string;
    emailAddressLabel: string;
    createPasswordLabel: string;
    redeemButton: string;
    redeemingButton: string;
    mfaKicker: string;
    mfaTitle: string;
    mfaSubtitle: string;
    mfaTotpLabel: string;
    mfaRecoveryLabel: string;
    mfaVerifyButton: string;
    mfaVerifyingButton: string;
    mfaUseRecovery: string;
    mfaUseApp: string;
    mfaCancel: string;
    offlineTitle: string;
    offlineExistingDesc: string;
    offlineNewDesc: string;
    offlineOpenBtn: string;
    offlineModeBtn: string;
    passkeySignInBtn: string;
    passkeySigningInBtn: string;
    passkeyOrDivider: string;
    passkeyHint: string;
    passkeyUnsupported: string;
    passkeyCancelled: string;
    footerNote: string;
    heroKicker: string;
    heroTitle: string;
    heroDesc: string;
    pillar1Title: string;
    pillar1Desc: string;
    pillar2Title: string;
    pillar2Desc: string;
    pillar3Title: string;
    pillar3Desc: string;
    pillar4Title: string;
    pillar4Desc: string;
  };
  gate: {
    signedInAs: string;
    kicker: string;
    titleUnlock: string;
    titleInit: string;
    importedArchive: string;
    storedEnvelope: string;
    fingerprint: string;
    encryptedRecords: string;
    passphraseLabel: string;
    passphrasePlaceholder: string;
    kdfNote: string;
    unlockBtn: string;
    unlockingBtn: string;
    importBtn: string;
    revertBtn: string;
    clanNameEng: string;
    clanTitleZh: string;
    hallName: string;
    ancestralOrigin: string;
    generationPoem: string;
    encPassphrase: string;
    confirmPassphrase: string;
    seedSampleTitle: string;
    seedSampleDesc: string;
    createBtn: string;
    creatingBtn: string;
  };
  tree: {
    vaultKey: string;
    poemTitle: string;
    searchPlaceholder: string;
    addRelative: string;
    emptyTitle: string;
    emptyBlankDesc: string;
    emptyFilterDesc: string;
    recordFoundingBtn: string;
    marriageChar: string;
    genPoemSuffix: string;
    editZupu: string;
    editZupuTitle: string;
    saveZupu: string;
    savingZupu: string;
    poemHint: string;
    zupuRequiredError: string;
    traceHint: string;
    clearHighlight: string;
    legendParent: string;
    legendSpouse: string;
    fitView: string;
    branchesTitle: string;
    branchesHint: string;
    branchLabelEn: string;
    branchLabelZh: string;
    addBranchBtn: string;
    removeBranchBtn: string;
    branchInUseTitle: string;
    branchMinOneError: string;
    branchRequiredError: string;
  };
  ledger: {
    kicker: string;
    title: string;
    filterPlaceholder: string;
    colGen: string;
    colName: string;
    colCourtesy: string;
    colBranch: string;
    colLifespan: string;
    colOrigin: string;
    colTier: string;
    colAction: string;
    noMatches: string;
    piiRedacted: string;
    inspect: string;
  };
  drawer: {
    newKicker: string;
    newTitle: string;
    chineseName: string;
    romanizedName: string;
    generation: string;
    branch: string;
    courtesy: string;
    artName: string;
    sensitivity: string;
    birthOrder: string;
    livingRelative: string;
    birthYear: string;
    lunarBirth: string;
    deathYear: string;
    lunarDeath: string;
    birthplace: string;
    occupation: string;
    currentResidence: string;
    biography: string;
    sealedTestament: string;
    saveRecord: string;
    savingRecord: string;
    editRecord: string;
    addChild: string;
    addSpouse: string;
    courtesyArtLabel: string;
    orderTitleLabel: string;
    datesLabel: string;
    originLabel: string;
    residenceLabel: string;
    piiRestrictedMsg: string;
    noBio: string;
    noSealed: string;
    sealedWithheldMsg: string;
    lineageLinks: string;
    parents: string;
    foundingUnlinked: string;
    spouse: string;
    children: string;
    removeRecord: string;
    gender: string;
    genderMale: string;
    genderFemale: string;
    parentsSelect: string;
    spousesSelect: string;
    relationshipHint: string;
    nameRequiredError: string;
    romanizeSchemeCantonese: string;
    romanizeSchemePinyin: string;
    romanizeAutoHint: string;
    romanizeRegenerate: string;
    chineseNamePlaceholder: string;
    romanizedNamePlaceholder: string;
    portraitTitle: string;
    portraitDesc: string;
    portraitUploadBtn: string;
    portraitReplaceBtn: string;
    portraitRemoveBtn: string;
  };
  roles: {
    kicker: string;
    title: string;
    yourRole: string;
    offlineTitle: string;
    offlineDesc: string;
    accountsTitle: string;
    rbacSubtitle: string;
    loading: string;
    mfaActive: string;
    mfaNotEnrolled: string;
    statusActive: string;
    statusSuspended: string;
    grantsPrefix: string;
    readOnlyFallback: string;
    depthCap: string;
    configureBtn: string;
    editAccountBtn: string;
    cancelEditBtn: string;
    accountIdentitySection: string;
    permissionsSection: string;
    accountEmail: string;
    primaryRole: string;
    branchScope: string;
    maxDepth: string;
    accountStatus: string;
    activeMemberOpt: string;
    suspendedOpt: string;
    savePermsBtn: string;
    saveAccountBtn: string;
    savingBtn: string;
    updatedNoticePrefix: string;
    nameEmailRequiredError: string;
    custodianRecoverySection: string;
    newTempPassword: string;
    newTempPasswordPlaceholder: string;
    genTempPasswordBtn: string;
    resetPasswordBtn: string;
    resettingPasswordBtn: string;
    resetMfaBtn: string;
    confirmResetMfaBtn: string;
    resettingMfaBtn: string;
    mfaAlreadyClear: string;
    passwordResetSuccess: string;
    passwordMinLengthError: string;
    mfaResetSuccess: string;
    passkeysRegisteredSuffix: string;
    resetPasskeysBtn: string;
    confirmResetPasskeysBtn: string;
    resettingPasskeysBtn: string;
    passkeysResetSuccess: string;
    passkeysAlreadyClear: string;
    recoveryHint: string;
    permLivingPii: string;
    permElderSealed: string;
    permEditLineage: string;
    permExportVault: string;
    permInviteRelatives: string;
    permManageRoles: string;
    issueInviteTitle: string;
    issueInviteDesc: string;
    relEngName: string;
    relZhName: string;
    boundEmail: string;
    assignedRole: string;
    genInviteBtn: string;
    generatingBtn: string;
    inviteReady: string;
    issuedInvitesTitle: string;
    noInvites: string;
    redeemedOn: string;
    expiresOn: string;
    auditTitle: string;
    eventsCount: string;
    colTime: string;
    colActor: string;
    colEvent: string;
    colTarget: string;
    colDetail: string;
    coCustodianBadge: string;
    transferTitle: string;
    transferDesc: string;
    transferTargetLabel: string;
    transferPasswordLabel: string;
    transferTotpLabel: string;
    transferConfirmPrompt: string;
    transferBtn: string;
    transferConfirmBtn: string;
    transferringBtn: string;
    transferSuccessPrefix: string;
    noEligibleSuccessor: string;
  };
  mfa: {
    kicker: string;
    title: string;
    authenticatorSubtitle: string;
    cardTitle: string;
    activeBadge: string;
    notEnrolledBadge: string;
    offlineNote: string;
    activeDesc: string;
    recoveryTitle: string;
    recoveryDesc: string;
    disableTitle: string;
    disableBtn: string;
    enrollDesc: string;
    enrollBtn: string;
    step1: string;
    step2: string;
    verifyActivateBtn: string;
    rotateKeyTitle: string;
    rotateKeyDesc: string;
    reEncryptBtn: string;
    currentPassphraseLabel: string;
    newPassphraseLabel: string;
    confirmNewPassphraseLabel: string;
    currentPassphraseRequiredError: string;
    currentPassphraseInvalidError: string;
    passphraseUnchangedError: string;
    passphraseMinLengthError: string;
    passphraseMismatchError: string;
    rotateConfirmPrompt: string;
    rotateConfirmBtn: string;
    rotateCustodianOnlyNote: string;
    rotateBackupPromptTitle: string;
    rotateBackupPromptDesc: string;
    downloadUpdatedArchiveBtn: string;
    archiveExportedNotice: string;
    changePwTitle: string;
    updatePwBtn: string;
    custodySheetTitle: string;
    custodySheetDesc: string;
    custodySheetBtn: string;
    custodySheetGenerating: string;
    custodySheetSuccess: string;
    passkeySubtitle: string;
    passkeyTitle: string;
    passkeyCountBadge: string;
    passkeyNoneBadge: string;
    passkeyDesc: string;
    passkeyOfflineNote: string;
    passkeyLabelPlaceholder: string;
    passkeyAddBtn: string;
    passkeyAddingBtn: string;
    passkeyDeviceMulti: string;
    passkeyDeviceSingle: string;
    passkeyBackedUp: string;
    passkeyAddedOn: string;
    passkeyLastUsed: string;
    passkeyNeverUsed: string;
    passkeyRenameBtn: string;
    passkeySaveNameBtn: string;
    passkeyRemoveBtn: string;
    passkeyConfirmRemoveBtn: string;
    passkeyMaxNote: string;
    passkeyAddedNotice: string;
    passkeyRenamedNotice: string;
    passkeyRemovedNotice: string;
    passkeyUnsupported: string;
    showSecretAria: string;
    hideSecretAria: string;
    generateDicewareBtn: string;
    strengthWeak: string;
    strengthFair: string;
    strengthGood: string;
    strengthStrong: string;
    autoLockTitle: string;
    autoLockDesc: string;
    autoLockLabel: string;
    autoLockOff: string;
    autoLockMinutesSuffix: string;
    autoLockNotice: string;
    sessionsTitle: string;
    sessionsDesc: string;
    sessionsCurrentBadge: string;
    sessionsRevokeOthersBtn: string;
    sessionsRevokingBtn: string;
    sessionsRevokeOneBtn: string;
    sessionsEmpty: string;
    sessionsRevokedNotice: string;
    signInAlertsTitle: string;
    signInAlertsEmpty: string;
    sessionLastSeen: string;
  };
  offline: {
    kicker: string;
    title: string;
    hybridTitle: string;
    hybridDesc: string;
    airgapTitle: string;
    airgapDesc: string;
    selected: string;
    switchLabel: string;
    archiveTitle: string;
    archiveDesc: string;
    pendingWarning: string;
    pushSyncBtn: string;
    exportBtn: string;
    restoreFileBtn: string;
    snapshotsTitle: string;
    snapshotsDesc: string;
    snapshotPlaceholder: string;
    saveSnapshotBtn: string;
    noSnapshots: string;
    restoreBtn: string;
    interchangeTitle: string;
    interchangeDesc: string;
    exportCsvBtn: string;
    exportGedcomBtn: string;
    importInterchangeBtn: string;
    csvExportedNotice: string;
    gedExportedNotice: string;
    importPreviewPrefix: string;
    importPreviewSuffix: string;
    mergeImportBtn: string;
    replaceImportBtn: string;
    importCommittedNotice: string;
    serverHistoryTitle: string;
    serverHistoryDesc: string;
    serverHistoryEmpty: string;
    rollbackBtn: string;
    confirmRollbackBtn: string;
    rollbackSuccess: string;
    autoSnapshotHint: string;
  };
  forcePw: {
    kicker: string;
    title: string;
    descPrefix: string;
    descSuffix: string;
    tempPasswordLabel: string;
    tempPasswordPlaceholder: string;
    newPasswordLabel: string;
    newPasswordPlaceholder: string;
    confirmPasswordLabel: string;
    submitBtn: string;
    savingBtn: string;
    differentError: string;
    mismatchError: string;
    securityNote: string;
  };
  chronology: {
    kicker: string;
    title: string;
    metricRecords: string;
    metricGenerations: string;
    metricSpan: string;
    recordedBirthSpan: string;
    metricUnions: string;
    activeBranchesSuffix: string;
    genBreakdownTitle: string;
    genBreakdownDesc: string;
    branchBalanceTitle: string;
    migrationTitle: string;
    ancestralTownsLabel: string;
    livingHubsLabel: string;
    timelineTitle: string;
    timelineDesc: string;
    memorialTitle: string;
    memorialDesc: string;
    memorialFilterAll: string;
    memorialFilterDeath: string;
    memorialFilterBirth: string;
    memorialFilterFestival: string;
    memorialExportIcs: string;
    memorialIcsSuccess: string;
    memorialEmpty: string;
    memorialToday: string;
    memorialTomorrow: string;
    memorialInDaysPrefix: string;
    memorialInDaysSuffix: string;
  };
  pdf: {
    exportBtn: string;
    modalKicker: string;
    modalTitle: string;
    modalDesc: string;
    branchLabel: string;
    includeTree: string;
    includeLivingPii: string;
    livingPiiRestricted: string;
    includeSealed: string;
    sealedRestricted: string;
    recordsPreview: string;
    downloadBtn: string;
    generatingBtn: string;
    successNotice: string;
    coverKicker: string;
    exportedBy: string;
    exportedAt: string;
    recordsCount: string;
    treeHeading: string;
    chroniclesHeading: string;
    redactedAddress: string;
    confidentialFooter: string;
    pageLabel: string;
    pdfACompliant: string;
    pdfACompliantHint: string;
  };
  audit: {
    openBtn: string;
    modalKicker: string;
    modalTitle: string;
    modalDesc: string;
    duplicatesHeading: string;
    noDuplicates: string;
    keepLeftBtn: string;
    keepRightBtn: string;
    linkIssuesHeading: string;
    noLinkIssues: string;
    repairAllBtn: string;
    issueAsymmetricSpouse: string;
    issueDanglingParent: string;
    issueDanglingSpouse: string;
    allCleanTitle: string;
    allCleanDesc: string;
    mergeSuccess: string;
    repairSuccess: string;
    busyLabel: string;
  };
  conflict: {
    kicker: string;
    title: string;
    desc: string;
    reloadBtn: string;
    forceBtn: string;
    reloadingBtn: string;
    forcingBtn: string;
    revisionLabel: string;
  };
}

const EN_HK: TranslationDict = {
  common: {
    brand: 'ZupuVault',
    brandTag: '宗族世系 · 私密典藏',
    loading: 'Initialising sovereign cryptographic environment...',
    signOut: 'Sign Out',
    lockVault: 'Lock Vault',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    copy: 'Copy',
    copied: 'Copied',
    dismiss: 'Dismiss',
    present: 'Present',
    living: 'Living',
    ancestor: 'Ancestor',
    piiHidden: 'PII Hidden',
    noneRecorded: 'None recorded',
    allBranches: 'All Branches',
    allTiers: 'All Tiers',
    genPrefix: 'Gen',
  },
  nav: {
    tree: 'Lineage Tree',
    ledger: 'Clan Ledger',
    chronology: 'Chronology',
    roles: 'Access & Roles',
    mfa: 'Security & MFA',
    offline: 'Offline Vault',
  },
  ribbon: {
    custodian: 'Custodian',
    role: 'Role',
    storage: 'Storage',
    hybridSync: 'Hybrid Sovereign Sync',
    offlineOnly: 'Air-Gapped IndexedDB',
    pendingSync: 'Pending Local Sync',
    mfaVerified: 'MFA Verified',
    passwordSession: 'Password Session',
  },
  auth: {
    kicker: 'Sovereign Family Archive · Zero-Knowledge Cryptography',
    titleClaim: 'Establish Family Archive Custody',
    titleInvite: 'Verify Relative Invitation',
    titleLogin: 'Sign In to Family Node',
    tabClaim: 'Claim Custody',
    tabLogin: 'Member Sign In',
    tabInvite: 'Redeem Invite',
    accessNotice: 'Access Notice:',
    custodianEngName: 'Custodian English Name',
    chineseNameLabel: 'Chinese Lineage Name (姓名)',
    custodianEmail: 'Custodian Email',
    custodianPassword: 'Account Login Password (min. 8 characters)',
    envPasscodeLabel: 'Server FAMILY_ADMIN_PASSCODE',
    claimButton: 'Claim Patriarch Custody',
    claimingButton: 'Establishing Custody...',
    memberEmail: 'Verified Relative Email',
    passwordLabel: 'Password',
    signInButton: 'Sign In to Lineage Node',
    signingInButton: 'Verifying...',
    inviteCodeLabel: 'Single-Use Family Invite Code',
    fullNameLabel: 'Your Full Name',
    emailAddressLabel: 'Email Address',
    createPasswordLabel: 'Create Account Password (min. 8 characters)',
    redeemButton: 'Complete Relative Verification',
    redeemingButton: 'Verifying Invitation...',
    mfaKicker: 'Multi-Factor Verification',
    mfaTitle: 'Authenticator Challenge',
    mfaSubtitle: 'Enter the 6-digit code from your authenticator app or a single-use recovery code.',
    mfaTotpLabel: '6-Digit TOTP Code',
    mfaRecoveryLabel: 'One-Time Recovery Code',
    mfaVerifyButton: 'Verify & Continue',
    mfaVerifyingButton: 'Checking Code...',
    mfaUseRecovery: 'Use backup recovery code',
    mfaUseApp: 'Use 6-digit authenticator app',
    mfaCancel: 'Cancel sign in',
    offlineTitle: 'Air-Gapped Offline Local Vault',
    offlineExistingDesc: 'An encrypted local clan vault is stored in this browser’s IndexedDB.',
    offlineNewDesc: 'Store and encrypt genealogical records exclusively on this device with zero server transmission.',
    offlineOpenBtn: 'Open Offline Vault',
    offlineModeBtn: 'Offline-Only Mode',
    passkeySignInBtn: 'Sign In with Passkey',
    passkeySigningInBtn: 'Verifying Passkey...',
    passkeyOrDivider: 'or sign in passwordless',
    passkeyHint: 'Leave email blank to pick any saved Passkey on this device, or enter your email to scope your account keys.',
    passkeyUnsupported: 'Passkeys require a WebAuthn-compatible browser over HTTPS.',
    passkeyCancelled: 'Passkey verification was cancelled or timed out.',
    footerNote: 'Sessions remain strictly in memory · Lineage records encrypted before leaving the browser',
    heroKicker: '家族譜牒 · 數據主權',
    heroTitle: 'Private Lineage Stewardship Across Generations',
    heroDesc: 'Every name, courtesy title, and ancestral chronicle is sealed client-side with AES-256-GCM before storage, accessible only to verified relatives under granular branch permissions.',
    pillar1Title: 'End-to-End AES-256-GCM',
    pillar1Desc: 'PBKDF2 310k key derivation',
    pillar2Title: 'RFC 6238 TOTP MFA',
    pillar2Desc: 'Authenticator + recovery codes',
    pillar3Title: 'Granular Branch RBAC',
    pillar3Desc: 'Per-member sealed & PII gates',
    pillar4Title: 'Offline IndexedDB & .zupu',
    pillar4Desc: 'Local-only & portable backups',
  },
  gate: {
    signedInAs: 'Signed in as',
    kicker: 'Client-Side AES-256-GCM · Key Never Leaves Browser Memory',
    titleUnlock: 'Decrypt Family Lineage Vault',
    titleInit: 'Initialise Encrypted Family Scroll',
    importedArchive: 'Imported Archive',
    storedEnvelope: 'Stored Ciphertext Envelope',
    fingerprint: 'Fingerprint',
    encryptedRecords: 'encrypted records',
    passphraseLabel: 'Family Vault Encryption Passphrase',
    passphrasePlaceholder: 'Enter the family AES-256 encryption passphrase',
    kdfNote: 'Derived locally via PBKDF2-SHA256',
    unlockBtn: 'Decrypt & Open Lineage',
    unlockingBtn: 'Deriving Key & Decrypting...',
    importBtn: 'Import .zupu',
    revertBtn: 'Revert to vault',
    clanNameEng: 'Clan Name (English)',
    clanTitleZh: 'Chinese Zupu Title (宗譜題名)',
    hallName: 'Ancestral Hall Name (堂號)',
    ancestralOrigin: 'Ancestral Origin (郡望/祖籍)',
    generationPoem: 'Generation Poem Characters (字輩詩)',
    encPassphrase: 'Family Encryption Passphrase',
    confirmPassphrase: 'Confirm Passphrase',
    seedSampleTitle: 'Include 4-Generation Chen Clan (潁川陳氏) Sample Lineage',
    seedSampleDesc: 'Pre-populates 12 encrypted ancestral & living records across 3 branches so you can immediately explore and customise the Zupu tree.',
    createBtn: 'Create & Encrypt Family Vault',
    creatingBtn: 'Encrypting Scroll...',
  },
  tree: {
    vaultKey: 'Vault Key',
    poemTitle: 'Clan Generation Poem · 字輩詩',
    searchPlaceholder: 'Search name or courtesy title...',
    addRelative: 'Add Relative',
    emptyTitle: 'No Matching Lineage Records',
    emptyBlankDesc: 'This encrypted scroll does not contain any relatives yet. Add your founding ancestor to begin.',
    emptyFilterDesc: 'Adjust your search query or branch filter to view additional encrypted records.',
    recordFoundingBtn: 'Record Founding Ancestor',
    marriageChar: '姻',
    genPoemSuffix: '字輩',
    editZupu: 'Edit',
    editZupuTitle: 'Edit Zupu Scroll Metadata',
    saveZupu: 'Save Zupu Changes',
    savingZupu: 'Saving...',
    poemHint: 'Enter characters separated by spaces or continuous characters (each character maps to a generation).',
    zupuRequiredError: 'Both Clan Name (English) and Chinese Zupu Title are required.',
    traceHint: 'Click any member to inspect chronicle and trace full ancestral/descendant line',
    clearHighlight: 'Clear Trace',
    legendParent: 'Parent → Child',
    legendSpouse: 'Spouse',
    fitView: 'Fit',
    branchesTitle: 'Clan Branches (房別)',
    branchesHint: 'Configure custom family branches (e.g. Fourth Branch · 四房). Branches currently assigned to saved members stay locked against removal.',
    branchLabelEn: 'English Label',
    branchLabelZh: 'Chinese Label',
    addBranchBtn: 'Add Branch',
    removeBranchBtn: 'Remove',
    branchInUseTitle: 'Branch in use by existing records',
    branchMinOneError: 'At least one branch must remain defined.',
    branchRequiredError: 'Every branch must include both an English and Chinese label.',
  },
  ledger: {
    kicker: '歐陽體譜表 · Archival Genealogy Register',
    title: 'Decrypted Clan Ledger',
    filterPlaceholder: 'Filter ledger...',
    colGen: 'Gen',
    colName: 'Lineage Name',
    colCourtesy: 'Courtesy & Art (字/號)',
    colBranch: 'Branch',
    colLifespan: 'Lifespan',
    colOrigin: 'Origin / Residence',
    colTier: 'Classification',
    colAction: 'Action',
    noMatches: 'No lineage entries match the current filter.',
    piiRedacted: 'Living PII Redacted',
    inspect: 'Inspect',
  },
  drawer: {
    newKicker: 'New Encrypted Lineage Record',
    newTitle: 'Add Relative to Zupu',
    chineseName: 'Chinese Name (姓名)',
    romanizedName: 'Romanised / English Name',
    generation: 'Generation',
    branch: 'Branch (房別)',
    courtesy: 'Courtesy (字)',
    artName: 'Art Name (號)',
    sensitivity: 'Sensitivity Tier',
    birthOrder: 'Birth Order (排行)',
    livingRelative: 'Living Relative',
    birthYear: 'Birth Year',
    lunarBirth: 'Lunar Birth (農曆)',
    deathYear: 'Death Year',
    lunarDeath: 'Lunar Death',
    birthplace: 'Birthplace / Ancestral Town',
    occupation: 'Title / Occupation',
    currentResidence: 'Current Residence (Protected Living PII)',
    biography: 'Biographical Chronicle (生平事略)',
    sealedTestament: 'Elder Sealed Testament (長老密錄 · Private Notes)',
    saveRecord: 'Encrypt & Save Record',
    savingRecord: 'Encrypting & Saving...',
    editRecord: 'Edit Record',
    addChild: 'Add Child',
    addSpouse: 'Add Spouse',
    courtesyArtLabel: 'Courtesy & Art (字 / 號)',
    orderTitleLabel: 'Order & Title (排行/職銜)',
    datesLabel: 'Solar & Lunar Dates',
    originLabel: 'Ancestral Birthplace',
    residenceLabel: 'Current Residence',
    piiRestrictedMsg: 'Restricted (Requires Living PII Permission)',
    noBio: 'No biographical chronicle recorded.',
    noSealed: 'No sealed testament recorded for this member.',
    sealedWithheldMsg: 'Access withheld. Only relatives granted View Elder-Sealed Records permission can inspect private clan testaments.',
    lineageLinks: 'Direct Lineage Links · 世系關聯',
    parents: 'Parents:',
    foundingUnlinked: 'Founding / Unlinked',
    spouse: 'Spouse:',
    children: 'Children:',
    removeRecord: 'Remove Record',
    gender: 'Gender',
    genderMale: 'Male (男)',
    genderFemale: 'Female (女)',
    parentsSelect: 'Parents (父母)',
    spousesSelect: 'Spouses (配偶)',
    relationshipHint: 'Select relatives to link or unlink. Spouse links automatically stay symmetrical.',
    nameRequiredError: 'Both Chinese name and Romanised name are required.',
    romanizeSchemeCantonese: 'HK',
    romanizeSchemePinyin: 'Pinyin',
    romanizeAutoHint: 'Auto-generated from Chinese name · edit freely if custom.',
    romanizeRegenerate: 'Regenerate from Chinese name',
    chineseNamePlaceholder: 'e.g. 陳啟文',
    romanizedNamePlaceholder: 'e.g. Chan Kai Man',
    portraitTitle: 'Encrypted Archival Portrait',
    portraitDesc: 'Compressed locally & sealed inside AES-256-GCM.',
    portraitUploadBtn: 'Upload Photo',
    portraitReplaceBtn: 'Replace',
    portraitRemoveBtn: 'Remove',
  },
  roles: {
    kicker: '族規權限 · Granular Role & Branch Governance',
    title: 'Verified Relatives & Permissions',
    yourRole: 'Your Role:',
    offlineTitle: 'Offline Local Sovereignty Active',
    offlineDesc: 'You are operating strictly inside browser IndexedDB without a connected family server node. Multi-relative invitations and remote role enforcement are available when using Hybrid Sovereign Sync mode.',
    accountsTitle: 'Family Member Accounts',
    rbacSubtitle: 'Server-enforced RBAC & branch scoping',
    loading: 'Loading verified family accounts...',
    mfaActive: 'TOTP MFA Active',
    mfaNotEnrolled: 'MFA Not Enrolled',
    statusActive: 'Active Access',
    statusSuspended: 'Access Suspended',
    grantsPrefix: 'Grants:',
    readOnlyFallback: 'Public Ancestral Read-Only',
    depthCap: 'Depth Cap Gen',
    configureBtn: 'Edit Account',
    editAccountBtn: 'Edit Profile',
    cancelEditBtn: 'Cancel Edit',
    accountIdentitySection: 'Account Identity & Contact',
    permissionsSection: 'Role & Access Permissions',
    accountEmail: 'Login Email',
    primaryRole: 'Primary Role',
    branchScope: 'Branch Scope',
    maxDepth: 'Max Generation Depth (0 = All)',
    accountStatus: 'Account Status',
    activeMemberOpt: 'Active Verified Relative',
    suspendedOpt: 'Suspended (Revoke Access)',
    savePermsBtn: 'Save Account & Permissions',
    saveAccountBtn: 'Save Account Details',
    savingBtn: 'Saving...',
    updatedNoticePrefix: 'Updated account for',
    nameEmailRequiredError: 'Chinese name, English / Romanised name, and a valid email address are required.',
    custodianRecoverySection: 'Custodian Credential & MFA Recovery',
    newTempPassword: 'New Temporary Password (min 8 chars)',
    newTempPasswordPlaceholder: 'Enter or generate temporary password',
    genTempPasswordBtn: 'Generate',
    resetPasswordBtn: 'Reset Password',
    resettingPasswordBtn: 'Resetting...',
    resetMfaBtn: 'Reset TOTP MFA',
    confirmResetMfaBtn: 'Confirm Clear MFA',
    resettingMfaBtn: 'Clearing MFA...',
    mfaAlreadyClear: 'TOTP MFA is not currently enrolled on this account.',
    passwordResetSuccess: 'Password reset for',
    passwordMinLengthError: 'Temporary password must be at least 8 characters.',
    mfaResetSuccess: 'TOTP MFA and recovery codes cleared for',
    passkeysRegisteredSuffix: 'Passkeys',
    resetPasskeysBtn: 'Clear Passkeys',
    confirmResetPasskeysBtn: 'Confirm Clear Passkeys',
    resettingPasskeysBtn: 'Clearing Passkeys...',
    passkeysResetSuccess: 'Registered passkeys cleared for',
    passkeysAlreadyClear: 'No passkeys are registered on this account.',
    recoveryHint: 'Deliver any temporary password securely out-of-band. Resetting password or MFA immediately signs out other active sessions.',
    permLivingPii: 'View Living Relative PII & Addresses',
    permElderSealed: 'View Elder-Sealed Testaments',
    permEditLineage: 'Edit & Add Lineage Records',
    permExportVault: 'Export Encrypted .zupu Archives',
    permInviteRelatives: 'Issue Verified Relative Invites',
    permManageRoles: 'Manage Member Roles & Access',
    issueInviteTitle: 'Issue Single-Use Relative Invite',
    issueInviteDesc: 'Bind a verification code to a relative’s role and branch before sharing your Family Encryption Passphrase out-of-band.',
    relEngName: 'Relative Name (English)',
    relZhName: 'Chinese Name (姓名)',
    boundEmail: 'Bound Email (Optional)',
    assignedRole: 'Assigned Role',
    genInviteBtn: 'Generate Single-Use Invite',
    generatingBtn: 'Generating Invite...',
    inviteReady: 'Single-Use Invite Code Ready (Displayed Once)',
    issuedInvitesTitle: 'Issued Invitations',
    noInvites: 'No relative invitations have been issued yet.',
    redeemedOn: 'Redeemed',
    expiresOn: 'Expires',
    auditTitle: 'Clan Custody & Access Audit Log',
    eventsCount: 'events',
    colTime: 'Timestamp',
    colActor: 'Actor',
    colEvent: 'Action',
    colTarget: 'Target',
    colDetail: 'Detail',
    coCustodianBadge: 'Co-Custodian',
    transferTitle: 'Patriarch Succession · Transfer Custody',
    transferDesc: 'Promote a verified active relative to Primary Patriarch. Your account transitions smoothly to an Archivist Co-Custodian retaining role-management access.',
    transferTargetLabel: 'Designated Patriarch Successor',
    transferPasswordLabel: 'Confirm Current Patriarch Password',
    transferTotpLabel: '6-Digit TOTP Authenticator Code',
    transferConfirmPrompt: 'Confirm transferring Primary Patriarch custody to this relative? This action is recorded in the clan audit log.',
    transferBtn: 'Transfer Patriarch Custody',
    transferConfirmBtn: 'Confirm Custody Transfer',
    transferringBtn: 'Transferring Custody...',
    transferSuccessPrefix: 'Transferred Patriarch custody to',
    noEligibleSuccessor: 'Invite and verify at least one other active relative before transferring Patriarch custody.',
  },
  mfa: {
    kicker: '多重驗證與密鑰 · Cryptographic & Identity Hardening',
    title: 'Multi-Factor Authentication & Encryption Keys',
    authenticatorSubtitle: 'RFC 6238 Authenticator App',
    cardTitle: 'Multi-Factor Authentication (TOTP)',
    activeBadge: 'MFA Active',
    notEnrolledBadge: 'Not Enrolled',
    offlineNote: 'Account-level TOTP MFA applies when connected to the Sovereign Family Server node. In Air-Gapped Offline-Only mode, access to your IndexedDB scroll is protected directly by your PBKDF2 + AES-256-GCM Family Encryption Passphrase.',
    activeDesc: 'Every sign-in to this family node requires your 6-digit TOTP authenticator code or an unused single-use recovery code.',
    recoveryTitle: 'Save Your Single-Use Recovery Codes Offline',
    recoveryDesc: 'Store these codes in a physical safe. Each code works once if your authenticator device is unavailable.',
    disableTitle: 'Disable TOTP MFA',
    disableBtn: 'Disable MFA',
    enrollDesc: 'Protect your relative account with a time-based 6-digit authenticator code (Google Authenticator, 1Password, Authy, or hardware TOTP token).',
    enrollBtn: 'Enroll TOTP Authenticator',
    step1: '1. Scan this QR code with your authenticator app, or enter the Base32 secret key manually.',
    step2: '2. Enter 6-digit code from authenticator to activate',
    verifyActivateBtn: 'Verify & Activate',
    rotateKeyTitle: 'Rotate Family AES-256 Passphrase',
    rotateKeyDesc: 'Re-encrypts all lineage records locally with a new 16-byte salt and 310,000-round PBKDF2 key.',
    reEncryptBtn: 'Re-Encrypt Lineage Vault',
    currentPassphraseLabel: 'Current Family Encryption Passphrase',
    newPassphraseLabel: 'New Family Encryption Passphrase (min. 8 characters)',
    confirmNewPassphraseLabel: 'Confirm New Passphrase',
    currentPassphraseRequiredError: 'Please enter your current Family Encryption Passphrase.',
    currentPassphraseInvalidError: 'Current Family Encryption Passphrase is incorrect.',
    passphraseUnchangedError: 'New passphrase must differ from the current passphrase.',
    passphraseMinLengthError: 'New Family Encryption Passphrase must be at least 8 characters.',
    passphraseMismatchError: 'New encryption passphrases do not match.',
    rotateConfirmPrompt: 'Re-encrypt all lineage records with this new passphrase? Other relatives will need the new passphrase the next time they unlock the vault.',
    rotateConfirmBtn: 'Confirm Re-Encrypt',
    rotateCustodianOnlyNote: 'Only the Patriarch or an account granted Manage Member Roles permission can rotate the Family Encryption Passphrase.',
    rotateBackupPromptTitle: 'Passphrase Rotated · Update Offline Backups',
    rotateBackupPromptDesc: 'Earlier .zupu.json files remain encrypted with your previous passphrase. Download an updated backup archive and custody sheet now, and share the new passphrase out-of-band with relatives.',
    downloadUpdatedArchiveBtn: 'Download .zupu.json Backup',
    archiveExportedNotice: 'Downloaded updated .zupu.json encrypted backup.',
    changePwTitle: 'Change Account Login Password',
    updatePwBtn: 'Update Login Password',
    custodySheetTitle: 'Heir Custody & Passphrase Recovery Sheet',
    custodySheetDesc: 'Typesets a ceremonial A4 PDF with vault fingerprint, server URL, handwritten 2-of-2 split-heir passphrase boxes, and offline recovery checklist.',
    custodySheetBtn: 'Download Custody Sheet (PDF)',
    custodySheetGenerating: 'Typesetting Custody Sheet...',
    custodySheetSuccess: 'Downloaded Heir Custody & Passphrase Recovery Sheet (PDF).',
    passkeySubtitle: 'FIDO2 / WebAuthn Hardware & Biometric Keys',
    passkeyTitle: 'Passkeys',
    passkeyCountBadge: 'Registered',
    passkeyNoneBadge: 'No Passkeys',
    passkeyDesc: 'Register multiple Passkeys (Touch ID, Face ID, Windows Hello, iCloud Keychain, or YubiKey security keys) for passwordless, phishing-resistant sign-in across your devices.',
    passkeyOfflineNote: 'Passkeys authenticate your account against the Sovereign Family Server node and are not used in Air-Gapped Offline-Only mode.',
    passkeyLabelPlaceholder: 'Device label (e.g. MacBook Touch ID, YubiKey 5C)',
    passkeyAddBtn: 'Add Passkey',
    passkeyAddingBtn: 'Waiting for Device...',
    passkeyDeviceMulti: 'Synced Passkey',
    passkeyDeviceSingle: 'Hardware / Single Device',
    passkeyBackedUp: 'Backed Up',
    passkeyAddedOn: 'Added',
    passkeyLastUsed: 'Last used',
    passkeyNeverUsed: 'Not used yet',
    passkeyRenameBtn: 'Rename',
    passkeySaveNameBtn: 'Save',
    passkeyRemoveBtn: 'Remove',
    passkeyConfirmRemoveBtn: 'Confirm Remove',
    passkeyMaxNote: 'Up to 10 Passkeys supported per relative account.',
    passkeyAddedNotice: 'Added Passkey:',
    passkeyRenamedNotice: 'Updated Passkey label.',
    passkeyRemovedNotice: 'Removed Passkey from your account.',
    passkeyUnsupported: 'This browser or context does not support WebAuthn Passkeys.',
    showSecretAria: 'Show passphrase',
    hideSecretAria: 'Hide passphrase',
    generateDicewareBtn: 'Generate 5-Word',
    strengthWeak: 'Weak',
    strengthFair: 'Fair',
    strengthGood: 'Good',
    strengthStrong: 'Strong',
    autoLockTitle: 'Inactivity Auto-Lock & Active Devices',
    autoLockDesc: 'Automatically wipes encryption keys from browser memory after inactivity, and lets you inspect or revoke signed-in sessions.',
    autoLockLabel: 'Auto-Lock After Inactivity',
    autoLockOff: 'Disabled (Manual Lock Only)',
    autoLockMinutesSuffix: 'minutes',
    autoLockNotice: 'Vault locked automatically due to inactivity.',
    sessionsTitle: 'Active Signed-In Sessions',
    sessionsDesc: 'Other browsers or devices holding an active session for your account.',
    sessionsCurrentBadge: 'Current Device',
    sessionsRevokeOthersBtn: 'Sign Out All Other Devices',
    sessionsRevokingBtn: 'Signing Out...',
    sessionsRevokeOneBtn: 'Revoke',
    sessionsEmpty: 'No other active sessions found.',
    sessionsRevokedNotice: 'Signed out all other active devices.',
    signInAlertsTitle: 'Recent Sign-In Alerts',
    signInAlertsEmpty: 'No recent sign-in activity recorded.',
    sessionLastSeen: 'Last active',
  },
  offline: {
    kicker: '離線備份與主權 · Local IndexedDB & Cold Backup',
    title: 'Offline Data Storage & Sovereignty',
    hybridTitle: 'Hybrid Sovereign Sync',
    hybridDesc: 'Encrypted AES-256-GCM records mirror automatically in local IndexedDB for offline resilience while syncing ciphertext envelopes to your private family server node for verified relatives.',
    airgapTitle: 'Air-Gapped Offline-Only Vault',
    airgapDesc: 'Zero network transmission for genealogical mutations. All encrypted lineage records remain exclusively inside this device’s IndexedDB until you explicitly export a portable backup.',
    selected: 'Selected',
    switchLabel: 'Switch',
    archiveTitle: 'Portable Encrypted Archive (.zupu.json)',
    archiveDesc: 'Download a self-contained, SHA-256 checksummed encrypted genealogy bundle for USB cold storage or family safe custody. Only holders of the Family Encryption Passphrase can decrypt it.',
    pendingWarning: 'Local IndexedDB contains encrypted edits not yet pushed to the family server.',
    pushSyncBtn: 'Push Local Sync',
    exportBtn: 'Export Encrypted .zupu',
    restoreFileBtn: 'Restore .zupu File',
    snapshotsTitle: 'Local Browser IndexedDB Snapshots',
    snapshotsDesc: 'Point-in-time encrypted snapshots stored privately on this device.',
    snapshotPlaceholder: 'Snapshot label (e.g. Ching Ming 2026)',
    saveSnapshotBtn: 'Save Snapshot',
    noSnapshots: 'No local snapshots saved yet. Create a snapshot before major lineage revisions.',
    restoreBtn: 'Restore',
    interchangeTitle: 'Batch CSV & GEDCOM (5.5.1) Interchange',
    interchangeDesc: 'Export authorized clan records into UTF-8 CSV or standard GEDCOM (.ged) format for backup or migration, or import existing family spreadsheets and genealogy trees into your encrypted vault.',
    exportCsvBtn: 'Export CSV',
    exportGedcomBtn: 'Export GEDCOM',
    importInterchangeBtn: 'Import CSV / GEDCOM',
    csvExportedNotice: 'Exported RBAC-filtered UTF-8 CSV ledger',
    gedExportedNotice: 'Exported RBAC-filtered GEDCOM 5.5.1 archive',
    importPreviewPrefix: 'Ready to encrypt & import',
    importPreviewSuffix: 'parsed lineage records into this vault.',
    mergeImportBtn: 'Merge into Vault',
    replaceImportBtn: 'Replace All Records',
    importCommittedNotice: 'Encrypted & saved imported lineage records',
    serverHistoryTitle: 'Server Vault Revision History (Last 5 Revisions)',
    serverHistoryDesc: 'Automatically archived before every server sync, passphrase rotation, or rollback.',
    serverHistoryEmpty: 'No prior server revisions archived yet.',
    rollbackBtn: 'Rollback',
    confirmRollbackBtn: 'Confirm Rollback',
    rollbackSuccess: 'Rolled back server vault to revision',
    autoSnapshotHint: 'Local pre-rotation and pre-import snapshots are saved automatically below.',
  },
  forcePw: {
    kicker: 'Custodian Password Reset Enforced',
    title: 'Set Your Personal Account Password',
    descPrefix: 'A Clan Custodian issued a temporary password for',
    descSuffix: '. Replace it with a personal password before unlocking the encrypted family scroll.',
    tempPasswordLabel: 'Current Temporary Password',
    tempPasswordPlaceholder: 'Enter the temporary password you signed in with',
    newPasswordLabel: 'New Personal Password (min. 8 characters)',
    newPasswordPlaceholder: 'Choose a strong personal login password',
    confirmPasswordLabel: 'Confirm New Password',
    submitBtn: 'Save Personal Password & Continue',
    savingBtn: 'Updating Password...',
    differentError: 'Your new personal password must differ from the temporary password.',
    mismatchError: 'New password and confirmation do not match.',
    securityNote: 'Updating your password revokes older temporary sessions and preserves your Family Vault encryption key.',
  },
  chronology: {
    kicker: '世代統計與紀年 · Lineage Demographics & Historical Span',
    title: 'Clan Chronology & Statistics Overview',
    metricRecords: 'Authorized Records',
    metricGenerations: 'Generations Recorded',
    metricSpan: 'Recorded Birth Span',
    recordedBirthSpan: 'Earliest to latest recorded year',
    metricUnions: 'Recorded Marriages',
    activeBranchesSuffix: 'branches active',
    genBreakdownTitle: 'Generational Population & Living Ratio',
    genBreakdownDesc: 'Distribution across generation poem tiers (Ancestors vs. Living)',
    branchBalanceTitle: 'Branch Representation (房別分佈)',
    migrationTitle: 'Ancestral Towns & Residences',
    ancestralTownsLabel: 'Recorded Birthplaces / Origins',
    livingHubsLabel: 'Living Residence Hubs',
    timelineTitle: 'Chronological Era Ledger',
    timelineDesc: 'Authorized clan members ordered chronologically by recorded birth year (click any row to inspect)',
    memorialTitle: 'Ancestral Memorial Calendar · 忌辰與壽誕行事曆',
    memorialDesc: 'Resolves recorded Chinese lunar dates and solar dates across the next 12 months with living PII permissions enforced.',
    memorialFilterAll: 'All Observances',
    memorialFilterDeath: 'Ancestral Anniversaries',
    memorialFilterBirth: 'Birthdays & Commemorations',
    memorialFilterFestival: 'Clan Festivals',
    memorialExportIcs: 'Export .ics Calendar',
    memorialIcsSuccess: 'Exported ancestral memorial .ics calendar',
    memorialEmpty: 'No dated memorials or festivals found for the selected filter.',
    memorialToday: 'Today',
    memorialTomorrow: 'Tomorrow',
    memorialInDaysPrefix: 'In',
    memorialInDaysSuffix: 'days',
  },
  pdf: {
    exportBtn: 'Export PDF',
    modalKicker: 'Archival Print Edition · Zero-Knowledge Client Render',
    modalTitle: 'Export Zupu Lineage PDF',
    modalDesc: 'Generates an A4 archival PDF locally inside your browser with your active permissions enforced before output.',
    branchLabel: 'Branch Scope to Export',
    includeTree: 'Include Cover & Lineage Tree Diagram',
    includeLivingPii: 'Include Living Relatives’ Current Residences',
    livingPiiRestricted: 'Restricted by your role (Living addresses will be redacted)',
    includeSealed: 'Include Elder-Sealed Testaments (長老密錄)',
    sealedRestricted: 'Restricted by your role (Elder-sealed notes withheld)',
    recordsPreview: 'Records included in export:',
    downloadBtn: 'Download Zupu PDF',
    generatingBtn: 'Typesetting PDF...',
    successNotice: 'Downloaded archival Zupu PDF.',
    coverKicker: '宗族世系 · Archival Family Genealogy Edition',
    exportedBy: 'Exported by',
    exportedAt: 'Generated',
    recordsCount: 'Records',
    treeHeading: 'Generational Lineage Diagram · 世系總圖',
    chroniclesHeading: 'Generational Chronicles · 歐陽體世系詳錄',
    redactedAddress: '[Protected Living PII Redacted]',
    confidentialFooter: 'Private Family Archive · Confidential Genealogical Record',
    pageLabel: 'Page',
    pdfACompliant: 'Export as Archival PDF/A-1b (ISO 19005-1)',
    pdfACompliantHint: 'Embeds an sRGB ICC OutputIntent and XMP archival metadata for long-term family preservation.',
  },
  audit: {
    openBtn: 'Duplicate & Link Audit',
    modalKicker: 'Lineage Integrity & Deduplication',
    modalTitle: 'Duplicate Merge & Relationship Audit',
    modalDesc: 'Scans decrypted records for possible duplicate relatives, one-way spouse links, or dangling parent/spouse IDs.',
    duplicatesHeading: 'Possible Duplicate Pairs',
    noDuplicates: 'No duplicate members detected.',
    keepLeftBtn: 'Keep Left & Merge',
    keepRightBtn: 'Keep Right & Merge',
    linkIssuesHeading: 'Relationship Link Anomalies',
    noLinkIssues: 'All parent and spouse links are reciprocal and valid.',
    repairAllBtn: 'Repair All Relationship Links',
    issueAsymmetricSpouse: 'One-way spouse link (missing reciprocal link on partner)',
    issueDanglingParent: 'Dangling parent ID reference (removed or missing record)',
    issueDanglingSpouse: 'Dangling spouse ID reference (removed or missing record)',
    allCleanTitle: 'Lineage Integrity Verified',
    allCleanDesc: 'Zero duplicate pairs or broken parent/spouse links were found across your authorized vault records.',
    mergeSuccess: 'Merged duplicate records and re-linked descendants/spouses cleanly.',
    repairSuccess: 'Repaired all broken or one-way relationship links.',
    busyLabel: 'Updating Encrypted Vault...',
  },
  conflict: {
    kicker: 'Optimistic Revision Lock · HTTP 409 Conflict',
    title: 'Server Vault Has Newer Edits',
    desc: 'Another custodian synced a newer revision to the family server since you unlocked your session. Reload the server archive or explicitly overwrite it.',
    reloadBtn: 'Reload Latest Server Vault',
    forceBtn: 'Overwrite Server with Mine',
    reloadingBtn: 'Loading Latest Vault...',
    forcingBtn: 'Overwriting Server...',
    revisionLabel: 'Server revision',
  },
};

const ZH_HK: TranslationDict = {
  common: {
    brand: '宗族秘藏 ZupuVault',
    brandTag: '宗族世系 · 私密典藏',
    loading: '正在初始化宗族加密安全環境⋯⋯',
    signOut: '登出',
    lockVault: '鎖定秘藏',
    cancel: '取消',
    save: '儲存',
    delete: '刪除',
    copy: '複製',
    copied: '已複製',
    dismiss: '關閉',
    present: '至今',
    living: '在世',
    ancestor: '先祖',
    piiHidden: '私隱已遮蔽',
    noneRecorded: '暫無記載',
    allBranches: '全族各房',
    allTiers: '全部保密等級',
    genPrefix: '第',
  },
  nav: {
    tree: '世系族譜圖',
    ledger: '歐陽體譜表',
    chronology: '世系統計',
    roles: '權限與角色',
    mfa: '雙重驗證與密鑰',
    offline: '離線保險庫',
  },
  ribbon: {
    custodian: '掌譜人',
    role: '身份權限',
    storage: '儲存模式',
    hybridSync: '混合主權同步',
    offlineOnly: '純離線本機儲存',
    pendingSync: '尚有本機變更待同步',
    mfaVerified: '已完成 TOTP 雙重驗證',
    passwordSession: '密碼登入工作階段',
  },
  auth: {
    kicker: '家族主權族譜 · 零知識端對端加密',
    titleClaim: '建立家族秘藏保管權',
    titleInvite: '驗證宗親邀請碼',
    titleLogin: '登入家族私密節點',
    tabClaim: '認領掌譜權',
    tabLogin: '宗親登入',
    tabInvite: '兌換邀請碼',
    accessNotice: '安全提示：',
    custodianEngName: '掌譜人英文姓名',
    chineseNameLabel: '中文宗譜姓名',
    custodianEmail: '掌譜人電郵',
    custodianPassword: '帳戶登入密碼（最少 8 位字元）',
    envPasscodeLabel: '伺服器 FAMILY_ADMIN_PASSCODE',
    claimButton: '認領族長掌譜權',
    claimingButton: '正在建立保管權⋯⋯',
    memberEmail: '已驗證宗親電郵',
    passwordLabel: '登入密碼',
    signInButton: '登入宗族節點',
    signingInButton: '正在驗證⋯⋯',
    inviteCodeLabel: '一次性宗親驗證邀請碼',
    fullNameLabel: '閣下英文全名',
    emailAddressLabel: '電郵地址',
    createPasswordLabel: '設定登入密碼（最少 8 位字元）',
    redeemButton: '完成宗親身份驗證',
    redeemingButton: '正在核驗邀請碼⋯⋯',
    mfaKicker: '雙重身份驗證',
    mfaTitle: '驗證器安全挑戰',
    mfaSubtitle: '請輸入身份驗證器應用程式顯示的 6 位數動態碼，或輸入一次性備用救援碼。',
    mfaTotpLabel: '6 位數 TOTP 驗證碼',
    mfaRecoveryLabel: '一次性備用救援碼',
    mfaVerifyButton: '驗證並繼續',
    mfaVerifyingButton: '正在核對驗證碼⋯⋯',
    mfaUseRecovery: '改用備用救援碼',
    mfaUseApp: '改用 6 位數驗證器',
    mfaCancel: '取消登入',
    offlineTitle: '氣隙隔離離線保險庫',
    offlineExistingDesc: '此瀏覽器的 IndexedDB 已存有加密的本機宗族族譜保險庫。',
    offlineNewDesc: '所有族譜資料僅加密儲存於本機裝置，完全不經任何伺服器傳輸。',
    offlineOpenBtn: '開啟離線保險庫',
    offlineModeBtn: '純離線模式',
    passkeySignInBtn: '使用通行密鑰 (Passkey) 登入',
    passkeySigningInBtn: '正在驗證通行密鑰⋯⋯',
    passkeyOrDivider: '或免密碼通行密鑰登入',
    passkeyHint: '留空電郵即可從此裝置選取任何已儲存的 Passkey，或輸入電郵以配對特定宗親帳戶之密鑰。',
    passkeyUnsupported: '通行密鑰需於支援 WebAuthn 的 HTTPS 瀏覽器環境中使用。',
    passkeyCancelled: '通行密鑰驗證已取消或逾時。',
    footerNote: '登入憑證僅留存於記憶體 · 譜牒資料於離開瀏覽器前已完成加密',
    heroKicker: '家族譜牒 · 數據主權',
    heroTitle: '世代傳承的私密宗族檔案',
    heroDesc: '每位先祖與宗親的姓名、字號及生平傳略均於用戶端以 AES-256-GCM 加密封存，僅限通過身份核驗並獲授權房份權限的族人查閱。',
    pillar1Title: '端對端 AES-256-GCM',
    pillar1Desc: 'PBKDF2 三十一萬次金鑰派生',
    pillar2Title: 'RFC 6238 雙重驗證',
    pillar2Desc: '動態驗證器及一次性救援碼',
    pillar3Title: '細粒度房份權限控制',
    pillar3Desc: '逐位成員設定私隱與密錄權限',
    pillar4Title: '離線 IndexedDB 與 .zupu',
    pillar4Desc: '純本機儲存及可攜式冷備份',
  },
  gate: {
    signedInAs: '目前登入身份：',
    kicker: '用戶端 AES-256-GCM 加密 · 密鑰永不離開瀏覽器記憶體',
    titleUnlock: '解密開啟宗族秘藏',
    titleInit: '建立加密家族宗譜卷宗',
    importedArchive: '已匯入加密備份檔',
    storedEnvelope: '已封存的加密封套',
    fingerprint: '金鑰指紋',
    encryptedRecords: '筆加密譜錄',
    passphraseLabel: '家族族譜加密主密碼',
    passphrasePlaceholder: '輸入家族 AES-256 加密主密碼',
    kdfNote: '於本機以 PBKDF2-SHA256 演算派生金鑰',
    unlockBtn: '解密並開啟族譜',
    unlockingBtn: '正在派生金鑰並解密⋯⋯',
    importBtn: '匯入 .zupu',
    revertBtn: '返回原保險庫',
    clanNameEng: '宗族英文名稱',
    clanTitleZh: '中文宗譜題名',
    hallName: '堂號',
    ancestralOrigin: '郡望／祖籍',
    generationPoem: '字輩詩（以空格分隔）',
    encPassphrase: '設定家族加密主密碼',
    confirmPassphrase: '確認加密主密碼',
    seedSampleTitle: '載入四代「潁川陳氏」示範族譜',
    seedSampleDesc: '預先建立 12 筆跨三房份的加密先祖與在世宗親紀錄，方便即時體驗並自行修改。',
    createBtn: '建立並加密家族保險庫',
    creatingBtn: '正在加密卷宗⋯⋯',
  },
  tree: {
    vaultKey: '保險庫金鑰',
    poemTitle: '宗族字輩詩',
    searchPlaceholder: '搜尋姓名、字號或房份⋯⋯',
    addRelative: '新增宗親',
    emptyTitle: '沒有符合條件的譜錄',
    emptyBlankDesc: '此加密宗譜尚未收錄任何成員，請先新增始遷祖以展開世系。',
    emptyFilterDesc: '請調整搜尋字詞或房份篩選條件以檢視其他加密紀錄。',
    recordFoundingBtn: '登錄始遷祖',
    marriageChar: '姻',
    genPoemSuffix: '字輩',
    editZupu: '編輯',
    editZupuTitle: '編輯宗譜卷首資料',
    saveZupu: '儲存宗譜變更',
    savingZupu: '正在儲存⋯⋯',
    poemHint: '輸入字輩詩文字，可使用空格分隔或連續輸入（每字對應一世）。',
    zupuRequiredError: '宗族英文名稱與中文宗譜題名均為必填項目。',
    traceHint: '點擊任意宗親可詳閱譜錄並追蹤完整上下世系脈絡',
    clearHighlight: '清除標示',
    legendParent: '父母 → 子女',
    legendSpouse: '配偶',
    fitView: '適應畫面',
    branchesTitle: '宗族房別設定（房別）',
    branchesHint: '可自訂宗族房別（例如四房）；仍有譜錄歸屬之房份將受保護，需先調動成員房別方可移除。',
    branchLabelEn: '英文名稱',
    branchLabelZh: '中文名稱',
    addBranchBtn: '新增房別',
    removeBranchBtn: '移除',
    branchInUseTitle: '尚有譜錄歸屬此房別，無法移除',
    branchMinOneError: '宗譜至少需保留一個房別。',
    branchRequiredError: '每個房別均須填寫英文及中文名稱。',
  },
  ledger: {
    kicker: '歐陽體譜表 · 典藏世系清冊',
    title: '已解密宗族總表',
    filterPlaceholder: '篩選譜表⋯⋯',
    colGen: '世次',
    colName: '姓名',
    colCourtesy: '字／號',
    colBranch: '房別',
    colLifespan: '生卒年份',
    colOrigin: '籍貫／現居地',
    colTier: '保密等級',
    colAction: '操作',
    noMatches: '沒有符合目前篩選條件的譜錄。',
    piiRedacted: '在世私隱已隱藏',
    inspect: '詳閱',
  },
  drawer: {
    newKicker: '新增加密世系紀錄',
    newTitle: '登錄宗親入譜',
    chineseName: '中文姓名',
    romanizedName: '英文／粵拼姓名',
    generation: '世次',
    branch: '房別',
    courtesy: '字',
    artName: '號',
    sensitivity: '保密等級',
    birthOrder: '排行',
    livingRelative: '在世宗親',
    birthYear: '出生年份',
    lunarBirth: '農曆生辰',
    deathYear: '辭世年份',
    lunarDeath: '農曆忌辰',
    birthplace: '出生地／祖籍',
    occupation: '職銜／生平業別',
    currentResidence: '現居地點（受保護之在世私隱）',
    biography: '生平事略',
    sealedTestament: '長老密錄／遺訓（僅限授權長老查閱）',
    saveRecord: '加密並儲存紀錄',
    savingRecord: '正在加密儲存⋯⋯',
    editRecord: '編輯紀錄',
    addChild: '新增子女',
    addSpouse: '新增配偶',
    courtesyArtLabel: '字／號',
    orderTitleLabel: '排行與職銜',
    datesLabel: '生卒與農曆記載',
    originLabel: '祖籍／出生地',
    residenceLabel: '現居地點',
    piiRestrictedMsg: '權限受限（需具備「檢視在世私隱」權限）',
    noBio: '暫無生平事略記載。',
    noSealed: '此成員暫無長老密錄記載。',
    sealedWithheldMsg: '未獲授權檢視。僅獲授「查閱長老密錄」權限的宗親方可閱讀私密遺訓與檔案。',
    lineageLinks: '世系關聯',
    parents: '父母：',
    foundingUnlinked: '始遷祖／未連結',
    spouse: '配偶：',
    children: '子女：',
    removeRecord: '移除此紀錄',
    gender: '性別',
    genderMale: '男',
    genderFemale: '女',
    parentsSelect: '父母連結',
    spousesSelect: '配偶連結',
    relationshipHint: '勾選或取消勾選宗親即可建立或解除世系關聯；配偶關聯將自動雙向同步。',
    nameRequiredError: '中文姓名與英文／粵拼姓名均為必填項目。',
    romanizeSchemeCantonese: '港式粵拼',
    romanizeSchemePinyin: '漢語拼音',
    romanizeAutoHint: '已按中文姓名自動生成，可直接修改或切換拼法。',
    romanizeRegenerate: '依中文姓名重新生成',
    chineseNamePlaceholder: '例如：陳啟文',
    romanizedNamePlaceholder: '例如：Chan Kai Man',
    portraitTitle: '加密典藏肖像照',
    portraitDesc: '於瀏覽器壓縮並封裝於 AES-256-GCM 密文內。',
    portraitUploadBtn: '上載肖像',
    portraitReplaceBtn: '更換照片',
    portraitRemoveBtn: '移除',
  },
  roles: {
    kicker: '族規權限 · 細粒度角色與房份治理',
    title: '已驗證宗親及權限管理',
    yourRole: '閣下身份：',
    offlineTitle: '純離線本機主權模式運作中',
    offlineDesc: '您目前僅於瀏覽器 IndexedDB 本機離線運作，未連線至家族伺服器節點。如需邀請多位宗親或執行遠端權限控管，請切換至混合主權同步模式。',
    accountsTitle: '家族成員帳戶',
    rbacSubtitle: '伺服器端強制執行 RBAC 與房份權限',
    loading: '正在載入已驗證宗親名單⋯⋯',
    mfaActive: '已啟用 TOTP 雙重驗證',
    mfaNotEnrolled: '尚未設定雙重驗證',
    statusActive: '權限有效',
    statusSuspended: '已停用存取',
    grantsPrefix: '授權項目：',
    readOnlyFallback: '僅限公開先祖世系唯讀',
    depthCap: '世代上限第',
    configureBtn: '編輯帳戶與權限',
    editAccountBtn: '編輯個人資料',
    cancelEditBtn: '取消編輯',
    accountIdentitySection: '帳戶身份與聯絡資料',
    permissionsSection: '角色與細部權限設定',
    accountEmail: '登入電郵地址',
    primaryRole: '主要角色',
    branchScope: '房份檢視範圍',
    maxDepth: '世代深度上限（0 為不限）',
    accountStatus: '帳戶狀態',
    activeMemberOpt: '已驗證在冊宗親',
    suspendedOpt: '停權（即時撤銷存取）',
    savePermsBtn: '儲存帳戶與權限',
    saveAccountBtn: '儲存帳戶資料',
    savingBtn: '儲存中⋯⋯',
    updatedNoticePrefix: '已更新帳戶資料：',
    nameEmailRequiredError: '請填寫中文姓名、英文／粵拼姓名及有效電郵地址。',
    custodianRecoverySection: '族長／掌譜人憑證與雙重驗證重設',
    newTempPassword: '重設臨時密碼（最少 8 字元）',
    newTempPasswordPlaceholder: '輸入或隨機產生臨時密碼',
    genTempPasswordBtn: '隨機產生',
    resetPasswordBtn: '重設密碼',
    resettingPasswordBtn: '重設中⋯⋯',
    resetMfaBtn: '重設 TOTP 雙重驗證',
    confirmResetMfaBtn: '確認清除雙重驗證',
    resettingMfaBtn: '清除中⋯⋯',
    mfaAlreadyClear: '此帳戶目前尚未啟用 TOTP 雙重驗證。',
    passwordResetSuccess: '已重設以下帳戶之登入密碼：',
    passwordMinLengthError: '重設密碼必須至少包含 8 個字元。',
    mfaResetSuccess: '已清除以下帳戶之 TOTP 雙重驗證與備用救援碼：',
    passkeysRegisteredSuffix: '組通行密鑰',
    resetPasskeysBtn: '重設通行密鑰',
    confirmResetPasskeysBtn: '確認清除通行密鑰',
    resettingPasskeysBtn: '清除中⋯⋯',
    passkeysResetSuccess: '已清除以下帳戶之全部通行密鑰：',
    passkeysAlreadyClear: '此帳戶目前尚未綁定任何通行密鑰。',
    recoveryHint: '重設密碼後請透過線下安全管道交付予宗親。重設密碼或雙重驗證將即時登出該帳戶其他裝置之連線。',
    permLivingPii: '檢視在世宗親私隱及地址',
    permElderSealed: '檢視長老密錄及家族遺訓',
    permEditLineage: '編輯及新增世系譜錄',
    permExportVault: '匯出 .zupu 加密備份檔',
    permInviteRelatives: '簽發宗親驗證邀請碼',
    permManageRoles: '管理宗親角色與權限',
    issueInviteTitle: '簽發一次性宗親邀請碼',
    issueInviteDesc: '先為宗親綁定角色與房份權限並產生驗證碼，再透過線下安全管道交付家族加密主密碼。',
    relEngName: '宗親英文姓名',
    relZhName: '宗親中文姓名',
    boundEmail: '指定電郵（選填）',
    assignedRole: '指派角色',
    genInviteBtn: '產生一次性邀請碼',
    generatingBtn: '正在產生邀請碼⋯⋯',
    inviteReady: '一次性宗親邀請碼已備妥（僅顯示此一次）',
    issuedInvitesTitle: '已簽發之邀請紀錄',
    noInvites: '暫未簽發任何宗親邀請碼。',
    redeemedOn: '已於以下日期兌換：',
    expiresOn: '有效期限至：',
    auditTitle: '宗族保管及存取稽核日誌',
    eventsCount: '筆紀錄',
    colTime: '時間戳記',
    colActor: '操作成員',
    colEvent: '執行動作',
    colTarget: '目標對象',
    colDetail: '詳細說明',
    coCustodianBadge: '協管長老',
    transferTitle: '族長承傳 · 移交掌譜權限',
    transferDesc: '將宗族最高掌譜「族長」身份移交予一位已驗證的在冊宗親。您將平滑轉為具備「管理宗親權限」之協管典藏人。',
    transferTargetLabel: '指定接任族長之宗親',
    transferPasswordLabel: '確認現任族長登入密碼',
    transferTotpLabel: '6 位數 TOTP 動態驗證碼',
    transferConfirmPrompt: '確定要將宗族最高「族長」權限移交予此宗親嗎？此操作將永久登錄於家族稽核日誌。',
    transferBtn: '移交族長權限',
    transferConfirmBtn: '確認移交族長',
    transferringBtn: '正在移交⋯⋯',
    transferSuccessPrefix: '已將族長保管權限移交予',
    noEligibleSuccessor: '請先邀請並驗證至少一位其他在冊宗親，方可進行族長移交。',
  },
  mfa: {
    kicker: '多重驗證與密鑰 · 加密與身份強化',
    title: '雙重驗證（MFA）與加密主密鑰',
    authenticatorSubtitle: 'RFC 6238 動態驗證器',
    cardTitle: '雙重身份驗證（TOTP）',
    activeBadge: '已啟用 MFA',
    notEnrolledBadge: '尚未啟用',
    offlineNote: '帳戶級 TOTP 雙重驗證適用於連線至家族伺服器節點時；於純離線模式下，本機 IndexedDB 宗譜直接受 PBKDF2 + AES-256-GCM 家族加密主密碼保護。',
    activeDesc: '每次登入此家族節點均須輸入 6 位數 TOTP 動態驗證碼，或未曾使用的一次性備用救援碼。',
    recoveryTitle: '請妥善離線抄存備用救援碼',
    recoveryDesc: '請將下列救援碼存放於實體保險箱，每組僅可使用一次，以防驗證器裝置遺失。',
    disableTitle: '停用 TOTP 雙重驗證',
    disableBtn: '停用雙重驗證',
    enrollDesc: '以每 30 秒更新的 6 位數動態驗證碼保護您的宗親帳戶（支援 Google Authenticator、1Password、Authy 或硬件令牌）。',
    enrollBtn: '啟用 TOTP 動態驗證器',
    step1: '1. 請使用驗證器掃描此二維碼，或手動輸入 Base32 密鑰。',
    step2: '2. 輸入驗證器顯示的 6 位數代碼以完成啟用',
    verifyActivateBtn: '驗證並啟用',
    rotateKeyTitle: '輪替家族 AES-256 加密主密碼',
    rotateKeyDesc: '於本機重新以全新隨機鹽值及 310,000 次 PBKDF2 演算重新加密全部譜錄。',
    reEncryptBtn: '重新加密宗族保險庫',
    currentPassphraseLabel: '目前家族加密主密碼',
    newPassphraseLabel: '新家族加密主密碼（至少 8 個字元）',
    confirmNewPassphraseLabel: '確認新加密主密碼',
    currentPassphraseRequiredError: '請輸入目前的家族加密主密碼。',
    currentPassphraseInvalidError: '目前的家族加密主密碼不正確。',
    passphraseUnchangedError: '新加密主密碼不可與目前密碼相同。',
    passphraseMinLengthError: '新家族加密主密碼須至少包含 8 個字元。',
    passphraseMismatchError: '兩次輸入的新加密主密碼不相符。',
    rotateConfirmPrompt: '確定要使用新主密碼重新加密全部譜錄嗎？其他宗親下次解鎖時須改用新主密碼。',
    rotateConfirmBtn: '確認重新加密',
    rotateCustodianOnlyNote: '僅族長或獲授「管理宗親權限」之帳戶可輪替家族加密主密碼。',
    rotateBackupPromptTitle: '主密碼已輪替 · 請更新離線備份',
    rotateBackupPromptDesc: '舊版 .zupu.json 備份仍使用舊主密碼加密。建議立即下載新版加密備份檔與繼承人交接憑證，並透過私密管道通知已驗證宗親。',
    downloadUpdatedArchiveBtn: '下載 .zupu.json 備份',
    archiveExportedNotice: '已下載最新加密 .zupu.json 備份檔。',
    changePwTitle: '變更帳戶登入密碼',
    updatePwBtn: '更新登入密碼',
    custodySheetTitle: '繼承人密鑰交接憑證（Heir Custody Sheet）',
    custodySheetDesc: '在瀏覽器本地排版生成 A4 典藏版實體交接單，內含金鑰指紋、伺服器網址、兩人分段保管手寫欄及緊急還原清單。',
    custodySheetBtn: '下載交接憑證 PDF',
    custodySheetGenerating: '正在排版生成交接單⋯⋯',
    custodySheetSuccess: '已下載繼承人密鑰交接憑證 PDF。',
    passkeySubtitle: 'FIDO2 / WebAuthn 硬體與生物識別密鑰',
    passkeyTitle: '通行密鑰 Passkeys',
    passkeyCountBadge: '已綁定',
    passkeyNoneBadge: '尚未綁定',
    passkeyDesc: '可為同一帳戶綁定多組通行密鑰（如 MacBook Touch ID、iPhone Face ID、Windows Hello 或 YubiKey 實體金鑰），以防網路釣魚及免密碼登入。',
    passkeyOfflineNote: '通行密鑰用於驗證並登入家族伺服器節點；純離線模式下僅由本機加密主密碼保護 IndexedDB。',
    passkeyLabelPlaceholder: '裝置標籤（例如：MacBook Touch ID、YubiKey 5C）',
    passkeyAddBtn: '新增通行密鑰',
    passkeyAddingBtn: '等待裝置授權⋯⋯',
    passkeyDeviceMulti: '跨裝置同步密鑰',
    passkeyDeviceSingle: '單一裝置／實體金鑰',
    passkeyBackedUp: '已備份',
    passkeyAddedOn: '建立於',
    passkeyLastUsed: '最近使用',
    passkeyNeverUsed: '尚未使用',
    passkeyRenameBtn: '重新命名',
    passkeySaveNameBtn: '儲存',
    passkeyRemoveBtn: '移除',
    passkeyConfirmRemoveBtn: '確認移除',
    passkeyMaxNote: '每位宗親帳戶最多可綁定 10 組通行密鑰。',
    passkeyAddedNotice: '已新增通行密鑰：',
    passkeyRenamedNotice: '已更新通行密鑰名稱。',
    passkeyRemovedNotice: '已從帳戶移除該通行密鑰。',
    passkeyUnsupported: '目前瀏覽器或連線環境不支援 WebAuthn 通行密鑰。',
    showSecretAria: '顯示密碼',
    hideSecretAria: '隱藏密碼',
    generateDicewareBtn: '產生 5 字詞密碼',
    strengthWeak: '弱',
    strengthFair: '尚可',
    strengthGood: '良好',
    strengthStrong: '極強',
    autoLockTitle: '閒置自動鎖定與裝置連線管理',
    autoLockDesc: '於指定閒置時間後自動清除瀏覽器記憶體中的解密金鑰，並可隨時檢視或登出其他裝置。',
    autoLockLabel: '閒置自動鎖定時限',
    autoLockOff: '停用（僅手動鎖定）',
    autoLockMinutesSuffix: '分鐘',
    autoLockNotice: '因閒置逾時，宗族秘藏已自動鎖定。',
    sessionsTitle: '目前有效登入工作階段',
    sessionsDesc: '持有閣下帳戶有效連線憑證之瀏覽器或裝置。',
    sessionsCurrentBadge: '目前裝置',
    sessionsRevokeOthersBtn: '登出全部其他裝置',
    sessionsRevokingBtn: '正在登出⋯⋯',
    sessionsRevokeOneBtn: '撤銷連線',
    sessionsEmpty: '暫無其他有效登入裝置。',
    sessionsRevokedNotice: '已強制登出所有其他裝置連線。',
    signInAlertsTitle: '近期登入安全紀錄',
    signInAlertsEmpty: '暫無近期登入活動紀錄。',
    sessionLastSeen: '最後活動',
  },
  offline: {
    kicker: '離線備份與主權 · 本機 IndexedDB 及冷備份',
    title: '離線儲存與家族數據主權',
    hybridTitle: '混合主權同步',
    hybridDesc: 'AES-256-GCM 加密譜錄會自動鏡像儲存於本機 IndexedDB 以備離線檢索，同時將密文封套同步至家族私密伺服器供已驗證宗親存取。',
    airgapTitle: '氣隙隔離純離線保險庫',
    airgapDesc: '所有譜系編修皆零網絡傳輸，加密資料僅存於此裝置瀏覽器的 IndexedDB 內，直至您手動匯出加密備份檔案。',
    selected: '目前模式',
    switchLabel: '切換至此模式',
    archiveTitle: '可攜式加密備份檔案（.zupu.json）',
    archiveDesc: '下載內含 SHA-256 完整性校驗碼的加密族譜封存檔，方便存入 USB 隨身碟或家族保險箱作冷備份。唯持有家族加密主密碼者方可解密。',
    pendingWarning: '本機 IndexedDB 尚有未推送至家族伺服器的加密變更。',
    pushSyncBtn: '立即推送同步',
    exportBtn: '匯出加密 .zupu 備份',
    restoreFileBtn: '匯入還原 .zupu 檔案',
    snapshotsTitle: '瀏覽器本機 IndexedDB 加密快照',
    snapshotsDesc: '儲存於此裝置的各時間點加密備份快照。',
    snapshotPlaceholder: '快照標籤（例如：2026 清明修譜）',
    saveSnapshotBtn: '建立本機快照',
    noSnapshots: '暫無本機快照，建議於大規模修譜前先建立加密快照。',
    restoreBtn: '還原此快照',
    interchangeTitle: '批次 CSV 與 GEDCOM (5.5.1) 匯入／匯出',
    interchangeDesc: '將授權範圍內的宗親譜錄匯出為支援中文的 UTF-8 CSV 試算表或國際標準 GEDCOM (.ged) 家譜格式，或將現有家族名冊批次匯入並加密封存至宗族保險庫。',
    exportCsvBtn: '匯出 CSV 清冊',
    exportGedcomBtn: '匯出 GEDCOM',
    importInterchangeBtn: '匯入 CSV / GEDCOM',
    csvExportedNotice: '已依權限匯出 UTF-8 CSV 宗親清冊',
    gedExportedNotice: '已依權限匯出 GEDCOM 5.5.1 家譜檔案',
    importPreviewPrefix: '已解析共',
    importPreviewSuffix: '筆譜錄，準備加密並存入此保險庫。',
    mergeImportBtn: '合併匯入保險庫',
    replaceImportBtn: '覆蓋全部譜錄',
    importCommittedNotice: '已將匯入譜錄完成 AES-256-GCM 加密並儲存',
    serverHistoryTitle: '伺服器歷史版本紀錄（最近 5 次修訂）',
    serverHistoryDesc: '每次推送同步、輪替主密碼或回溯前均會自動封存上一版本。',
    serverHistoryEmpty: '伺服器暫未存有先前修訂版本。',
    rollbackBtn: '回溯此版本',
    confirmRollbackBtn: '確認回溯',
    rollbackSuccess: '已將伺服器譜庫回溯至修訂版本',
    autoSnapshotHint: '於輪替主密碼或批次匯入前，系統會自動於下方建立本機保護快照。',
  },
  forcePw: {
    kicker: '掌譜人已重設密碼 · 強制安全更新',
    title: '設定閣下的個人登入密碼',
    descPrefix: '宗族掌譜人已為',
    descSuffix: '設定臨時登入密碼。請先更換為您私人的密碼，方可解鎖並查閱宗族加密譜牒。',
    tempPasswordLabel: '目前臨時密碼',
    tempPasswordPlaceholder: '輸入剛才登入使用的臨時密碼',
    newPasswordLabel: '設定個人新密碼（最少 8 位字元）',
    newPasswordPlaceholder: '輸入安全的個人登入密碼',
    confirmPasswordLabel: '確認新密碼',
    submitBtn: '更新個人密碼並繼續',
    savingBtn: '正在更新密碼⋯⋯',
    differentError: '新密碼不可與掌譜人發出的臨時密碼相同。',
    mismatchError: '兩次輸入的新密碼不相符。',
    securityNote: '更新個人密碼後將自動登出舊臨時工作階段，且不影響家族保險庫 AES-256 加密主密碼。',
  },
  chronology: {
    kicker: '世代統計與紀年 · Lineage Demographics & Historical Span',
    title: '宗族世系統計與紀年總覽',
    metricRecords: '授權可見譜錄',
    metricGenerations: '已登錄世代數',
    metricSpan: '生年紀年跨度',
    recordedBirthSpan: '最早至最近登錄之出生年份',
    metricUnions: '已登錄姻親聯姻',
    activeBranchesSuffix: '個在冊房份',
    genBreakdownTitle: '各世代人數與在世比例',
    genBreakdownDesc: '依字輩詩世代順序統計先祖與在世宗親分佈',
    branchBalanceTitle: '房別支脈分佈（房別）',
    migrationTitle: '祖籍源流與現居地分佈',
    ancestralTownsLabel: '祖籍／出生地記載',
    livingHubsLabel: '在世宗親聚居地',
    timelineTitle: '歷代人物生平紀年脈絡',
    timelineDesc: '依出生年份先後排列授權譜錄（點擊任意成員即可檢視詳情）',
    memorialTitle: '先祖忌辰與壽誕行事曆（農曆／西曆換算）',
    memorialDesc: '自動推算未來一年內之農曆忌辰、生辰及清明重陽節日（嚴格套用在世私隱權限）。',
    memorialFilterAll: '全部追思紀念',
    memorialFilterDeath: '先祖忌辰',
    memorialFilterBirth: '壽誕／冥壽',
    memorialFilterFestival: '宗族節日',
    memorialExportIcs: '匯出 .ics 行事曆',
    memorialIcsSuccess: '已匯出宗族忌辰壽誕 .ics 行事曆檔案',
    memorialEmpty: '目前篩選範圍內暫無已登錄日期之追思或節日。',
    memorialToday: '今日',
    memorialTomorrow: '明日',
    memorialInDaysPrefix: '尚餘',
    memorialInDaysSuffix: '日',
  },
  pdf: {
    exportBtn: '匯出 PDF',
    modalKicker: '典藏修譜版 · 用戶端本地即時排版',
    modalTitle: '匯出宗族家譜 PDF',
    modalDesc: '於瀏覽器本地即時排版生成 A4 典藏版 PDF，並嚴格依循您目前的宗親權限過濾敏感資料。',
    branchLabel: '匯出房份範圍',
    includeTree: '包含卷首封面與世系總圖',
    includeLivingPii: '包含在世宗親現居地址（私隱資料）',
    livingPiiRestricted: '權限受限（在世地址將自動遮蔽）',
    includeSealed: '包含長老密錄與遺訓（長老密錄）',
    sealedRestricted: '權限受限（長老密錄將自動隱藏）',
    recordsPreview: '本次匯出收錄譜錄數：',
    downloadBtn: '下載宗譜 PDF',
    generatingBtn: '正在排版生成 PDF⋯⋯',
    successNotice: '已下載典藏版宗譜 PDF。',
    coverKicker: '宗族世系 · 私密典藏修譜版',
    exportedBy: '匯出宗親',
    exportedAt: '製譜時間',
    recordsCount: '收錄人數',
    treeHeading: '宗族世系總圖',
    chroniclesHeading: '歐陽體世系詳錄',
    redactedAddress: '【在世私隱地址已依權限遮蔽】',
    confidentialFooter: '宗族私密譜牒 · 僅限授權宗親查閱',
    pageLabel: '頁次',
    pdfACompliant: '以典藏級 PDF/A-1b（ISO 19005-1）格式匯出',
    pdfACompliantHint: '內嵌 sRGB ICC 色彩設定檔及 XMP 典藏中繼資料，確保跨世代長期存檔相容。',
  },
  audit: {
    openBtn: '重複與關聯檢查',
    modalKicker: '世系完整性稽核與合併去重',
    modalTitle: '重複成員合併與世系關聯修復',
    modalDesc: '掃描已解密譜錄，偵測疑似重複登錄之宗親、單向配偶關聯或失效之父母／配偶編號。',
    duplicatesHeading: '疑似重複成員配對',
    noDuplicates: '暫未發現疑似重複的宗親紀錄。',
    keepLeftBtn: '保留左側並合併',
    keepRightBtn: '保留右側並合併',
    linkIssuesHeading: '世系關聯異常檢查',
    noLinkIssues: '所有父母與配偶關聯均已雙向對稱且有效。',
    repairAllBtn: '一鍵修復全部關聯異常',
    issueAsymmetricSpouse: '單向配偶關聯（對方譜錄未列出此配偶）',
    issueDanglingParent: '失效的父母編號參照（對應譜錄已移除或不存在）',
    issueDanglingSpouse: '失效的配偶編號參照（對應譜錄已移除或不存在）',
    allCleanTitle: '世系資料完整無誤',
    allCleanDesc: '目前授權譜錄中未發現重複成員或斷裂的世系關聯。',
    mergeSuccess: '已完成重複紀錄合併並自動重新連結子女及配偶。',
    repairSuccess: '已自動修復所有斷裂或單向之世系關聯。',
    busyLabel: '正在更新加密保險庫⋯⋯',
  },
  conflict: {
    kicker: '樂觀版本鎖定 · HTTP 409 版本衝突',
    title: '伺服器端宗譜已有較新修訂版本',
    desc: '在您開啟此工作階段後，另有掌譜人已向伺服器同步較新的加密版本。請選擇重新載入最新版本或強制覆寫伺服器資料：',
    reloadBtn: '重新載入伺服器最新版',
    forceBtn: '以本機版本覆寫伺服器',
    reloadingBtn: '正在載入最新加密版本⋯⋯',
    forcingBtn: '正在強制覆寫⋯⋯',
    revisionLabel: '伺服器版本號',
  },
};

const ZH_CN: TranslationDict = {
  common: {
    brand: '宗族秘藏 ZupuVault',
    brandTag: '宗族世系 · 私密典藏',
    loading: '正在初始化宗族加密安全环境……',
    signOut: '退出登录',
    lockVault: '锁定秘藏',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    copy: '复制',
    copied: '已复制',
    dismiss: '关闭',
    present: '至今',
    living: '在世',
    ancestor: '先祖',
    piiHidden: '隐私已隐藏',
    noneRecorded: '暂无记载',
    allBranches: '全族各房',
    allTiers: '全部保密等级',
    genPrefix: '第',
  },
  nav: {
    tree: '世系家谱图',
    ledger: '欧阳体谱表',
    chronology: '世系统计',
    roles: '权限与角色',
    mfa: '双重验证与密钥',
    offline: '离线保险库',
  },
  ribbon: {
    custodian: '掌谱人',
    role: '身份权限',
    storage: '存储模式',
    hybridSync: '混合主权同步',
    offlineOnly: '纯离线本地存储',
    pendingSync: '尚有本地变更待同步',
    mfaVerified: '已完成 TOTP 双重验证',
    passwordSession: '密码登录会话',
  },
  auth: {
    kicker: '家族主权家谱 · 零知识端到端加密',
    titleClaim: '建立家族秘藏保管权',
    titleInvite: '验证宗亲邀请码',
    titleLogin: '登录家族私密节点',
    tabClaim: '认领掌谱权',
    tabLogin: '宗亲登录',
    tabInvite: '兑换邀请码',
    accessNotice: '安全提示：',
    custodianEngName: '掌谱人英文姓名',
    chineseNameLabel: '中文家谱姓名',
    custodianEmail: '掌谱人邮箱',
    custodianPassword: '账户登录密码（至少 8 位字符）',
    envPasscodeLabel: '服务器 FAMILY_ADMIN_PASSCODE',
    claimButton: '认领族长掌谱权',
    claimingButton: '正在建立保管权……',
    memberEmail: '已验证宗亲邮箱',
    passwordLabel: '登录密码',
    signInButton: '登录宗族节点',
    signingInButton: '正在验证……',
    inviteCodeLabel: '一次性宗亲验证邀请码',
    fullNameLabel: '您的英文全名',
    emailAddressLabel: '邮箱地址',
    createPasswordLabel: '设置登录密码（至少 8 位字符）',
    redeemButton: '完成宗亲身份验证',
    redeemingButton: '正在核验邀请码……',
    mfaKicker: '双重身份验证',
    mfaTitle: '验证器安全挑战',
    mfaSubtitle: '请输入身份验证器应用显示的 6 位动态验证码，或输入一次性备用恢复码。',
    mfaTotpLabel: '6 位 TOTP 验证码',
    mfaRecoveryLabel: '一次性备用恢复码',
    mfaVerifyButton: '验证并继续',
    mfaVerifyingButton: '正在核对验证码……',
    mfaUseRecovery: '改用备用恢复码',
    mfaUseApp: '改用 6 位验证器',
    mfaCancel: '取消登录',
    offlineTitle: '气隙隔离离线保险库',
    offlineExistingDesc: '此浏览器的 IndexedDB 已存有加密的本地宗族家谱保险库。',
    offlineNewDesc: '所有家谱数据仅加密存储于本机设备，完全不经任何服务器传输。',
    offlineOpenBtn: '打开离线保险库',
    offlineModeBtn: '纯离线模式',
    passkeySignInBtn: '使用通行密钥 (Passkey) 登录',
    passkeySigningInBtn: '正在验证通行密钥……',
    passkeyOrDivider: '或免密码通行密钥登录',
    passkeyHint: '留空邮箱即可从此设备选取任意已保存的 Passkey，或输入邮箱以匹配特定宗亲账户的密钥。',
    passkeyUnsupported: '通行密钥需在支持 WebAuthn 的 HTTPS 浏览器环境中使用。',
    passkeyCancelled: '通行密钥验证已取消或超时。',
    footerNote: '登录凭证仅留存于内存 · 谱牒数据在离开浏览器前已完成加密',
    heroKicker: '家族谱牒 · 数据主权',
    heroTitle: '世代传承的私密宗族档案',
    heroDesc: '每位先祖与宗亲的姓名、字号及生平传略均在客户端以 AES-256-GCM 加密封存，仅限通过身份核验并获授权房份权限的族人查阅。',
    pillar1Title: '端到端 AES-256-GCM',
    pillar1Desc: 'PBKDF2 三十一万次密钥派生',
    pillar2Title: 'RFC 6238 双重验证',
    pillar2Desc: '动态验证器及一次性恢复码',
    pillar3Title: '细粒度房份权限控制',
    pillar3Desc: '逐位成员设置隐私与密录权限',
    pillar4Title: '离线 IndexedDB 与 .zupu',
    pillar4Desc: '纯本地存储及便携式冷备份',
  },
  gate: {
    signedInAs: '当前登录身份：',
    kicker: '客户端 AES-256-GCM 加密 · 密钥永不离开浏览器内存',
    titleUnlock: '解密打开宗族秘藏',
    titleInit: '创建加密家族家谱卷宗',
    importedArchive: '已导入加密备份文件',
    storedEnvelope: '已封存的加密信封',
    fingerprint: '密钥指纹',
    encryptedRecords: '条加密谱录',
    passphraseLabel: '家族家谱加密主密码',
    passphrasePlaceholder: '输入家族 AES-256 加密主密码',
    kdfNote: '在本地通过 PBKDF2-SHA256 算法派生密钥',
    unlockBtn: '解密并打开家谱',
    unlockingBtn: '正在派生密钥并解密……',
    importBtn: '导入 .zupu',
    revertBtn: '返回原保险库',
    clanNameEng: '宗族英文名称',
    clanTitleZh: '中文家谱题名',
    hallName: '堂号',
    ancestralOrigin: '郡望／祖籍',
    generationPoem: '字辈诗（以空格分隔）',
    encPassphrase: '设置家族加密主密码',
    confirmPassphrase: '确认加密主密码',
    seedSampleTitle: '载入四代“颍川陈氏”示范家谱',
    seedSampleDesc: '预先创建 12 条跨三房份的加密先祖与在世宗亲记录，方便立即体验并自行修改。',
    createBtn: '创建并加密家族保险库',
    creatingBtn: '正在加密卷宗……',
  },
  tree: {
    vaultKey: '保险库密钥',
    poemTitle: '宗族字辈诗',
    searchPlaceholder: '搜索姓名、字号或房份……',
    addRelative: '新增宗亲',
    emptyTitle: '没有符合条件的谱录',
    emptyBlankDesc: '此加密家谱尚未收录任何成员，请先新增始迁祖以展开世系。',
    emptyFilterDesc: '请调整搜索关键词或房份筛选条件以查看其他加密记录。',
    recordFoundingBtn: '登记始迁祖',
    marriageChar: '姻',
    genPoemSuffix: '字辈',
    editZupu: '编辑',
    editZupuTitle: '编辑家谱卷首资料',
    saveZupu: '保存家谱更改',
    savingZupu: '正在保存……',
    poemHint: '输入字辈诗文字，可使用空格分隔或连续输入（每字对应一世）。',
    zupuRequiredError: '宗族英文名称与中文家谱题名均为必填项目。',
    traceHint: '点击任意宗亲可详阅谱录并追踪完整上下世系脉络',
    clearHighlight: '清除标注',
    legendParent: '父母 → 子女',
    legendSpouse: '配偶',
    fitView: '适应画面',
    branchesTitle: '宗族房别设置（房别）',
    branchesHint: '可自定义宗族房别（例如四房）；仍有谱录归属的房份将受保护，需先调整成员房别方可移除。',
    branchLabelEn: '英文名称',
    branchLabelZh: '中文名称',
    addBranchBtn: '新增房别',
    removeBranchBtn: '移除',
    branchInUseTitle: '尚有谱录归属此房别，无法移除',
    branchMinOneError: '家谱至少需保留一个房别。',
    branchRequiredError: '每个房别均须填写英文及中文名称。',
  },
  ledger: {
    kicker: '欧阳体谱表 · 典藏世系清册',
    title: '已解密宗族总表',
    filterPlaceholder: '筛选谱表……',
    colGen: '世次',
    colName: '姓名',
    colCourtesy: '字／号',
    colBranch: '房别',
    colLifespan: '生卒年份',
    colOrigin: '籍贯／现居地',
    colTier: '保密等级',
    colAction: '操作',
    noMatches: '没有符合当前筛选条件的谱录。',
    piiRedacted: '在世隐私已隐藏',
    inspect: '详阅',
  },
  drawer: {
    newKicker: '新增加密世系记录',
    newTitle: '登记宗亲入谱',
    chineseName: '中文姓名',
    romanizedName: '英文／拼音姓名',
    generation: '世次',
    branch: '房别',
    courtesy: '字',
    artName: '号',
    sensitivity: '保密等级',
    birthOrder: '排行',
    livingRelative: '在世宗亲',
    birthYear: '出生年份',
    lunarBirth: '农历生辰',
    deathYear: '辞世年份',
    lunarDeath: '农历忌辰',
    birthplace: '出生地／祖籍',
    occupation: '职衔／生平业别',
    currentResidence: '现居地点（受保护的在世隐私）',
    biography: '生平事略',
    sealedTestament: '长老密录／遗训（仅限授权长老查阅）',
    saveRecord: '加密并保存记录',
    savingRecord: '正在加密保存……',
    editRecord: '编辑记录',
    addChild: '新增子女',
    addSpouse: '新增配偶',
    courtesyArtLabel: '字／号',
    orderTitleLabel: '排行与职衔',
    datesLabel: '生卒与农历记载',
    originLabel: '祖籍／出生地',
    residenceLabel: '现居地点',
    piiRestrictedMsg: '权限受限（需具备“查看在世隐私”权限）',
    noBio: '暂无生平事略记载。',
    noSealed: '此成员暂无长老密录记载。',
    sealedWithheldMsg: '未获授权查看。仅获授“查阅长老密录”权限的宗亲方可阅读私密遗训与档案。',
    lineageLinks: '世系关联',
    parents: '父母：',
    foundingUnlinked: '始迁祖／未关联',
    spouse: '配偶：',
    children: '子女：',
    removeRecord: '移除此记录',
    gender: '性别',
    genderMale: '男',
    genderFemale: '女',
    parentsSelect: '父母关联',
    spousesSelect: '配偶关联',
    relationshipHint: '勾选或取消勾选宗亲即可建立或解除世系关联；配偶关联将自动双向同步。',
    nameRequiredError: '中文姓名与英文／拼音姓名均为必填项目。',
    romanizeSchemeCantonese: '港式粤拼',
    romanizeSchemePinyin: '汉语拼音',
    romanizeAutoHint: '已按中文姓名自动生成，可直接修改或切换拼法。',
    romanizeRegenerate: '依中文姓名重新生成',
    chineseNamePlaceholder: '例如：陈启文',
    romanizedNamePlaceholder: '例如：Chen Qiwen',
    portraitTitle: '加密典藏肖像照',
    portraitDesc: '在浏览器压缩并封装于 AES-256-GCM 密文内。',
    portraitUploadBtn: '上传肖像',
    portraitReplaceBtn: '更换照片',
    portraitRemoveBtn: '移除',
  },
  roles: {
    kicker: '族规权限 · 细粒度角色与房份治理',
    title: '已验证宗亲及权限管理',
    yourRole: '您的身份：',
    offlineTitle: '纯离线本地主权模式运行中',
    offlineDesc: '您目前仅在浏览器 IndexedDB 本地离线运行，未连接至家族服务器节点。如需邀请多位宗亲或执行远程权限控制，请切换至混合主权同步模式。',
    accountsTitle: '家族成员账户',
    rbacSubtitle: '服务器端强制执行 RBAC 与房份权限',
    loading: '正在加载已验证宗亲名单……',
    mfaActive: '已启用 TOTP 双重验证',
    mfaNotEnrolled: '尚未设置双重验证',
    statusActive: '权限有效',
    statusSuspended: '已停用访问',
    grantsPrefix: '授权项目：',
    readOnlyFallback: '仅限公开先祖世系只读',
    depthCap: '世代上限第',
    configureBtn: '编辑账户与权限',
    editAccountBtn: '编辑个人资料',
    cancelEditBtn: '取消编辑',
    accountIdentitySection: '账户身份与联系资料',
    permissionsSection: '角色与细粒度权限设置',
    accountEmail: '登录邮箱地址',
    primaryRole: '主要角色',
    branchScope: '房份查看范围',
    maxDepth: '世代深度上限（0 为不限）',
    accountStatus: '账户状态',
    activeMemberOpt: '已验证在册宗亲',
    suspendedOpt: '停权（立即撤销访问）',
    savePermsBtn: '保存账户与权限',
    saveAccountBtn: '保存账户资料',
    savingBtn: '保存中……',
    updatedNoticePrefix: '已更新账户资料：',
    nameEmailRequiredError: '请填写中文姓名、英文／拼音姓名及有效邮箱地址。',
    custodianRecoverySection: '族长／掌谱人凭证与双重验证重置',
    newTempPassword: '重置临时密码（最少 8 个字符）',
    newTempPasswordPlaceholder: '输入或随机生成临时密码',
    genTempPasswordBtn: '随机生成',
    resetPasswordBtn: '重置密码',
    resettingPasswordBtn: '重置中……',
    resetMfaBtn: '重置 TOTP 双重验证',
    confirmResetMfaBtn: '确认清除双重验证',
    resettingMfaBtn: '清除中……',
    mfaAlreadyClear: '此账户当前尚未启用 TOTP 双重验证。',
    passwordResetSuccess: '已重置以下账户的登录密码：',
    passwordMinLengthError: '重置密码必须至少包含 8 个字符。',
    mfaResetSuccess: '已清除以下账户的 TOTP 双重验证与备用恢复码：',
    passkeysRegisteredSuffix: '组通行密钥',
    resetPasskeysBtn: '重置通行密钥',
    confirmResetPasskeysBtn: '确认清除通行密钥',
    resettingPasskeysBtn: '清除中……',
    passkeysResetSuccess: '已清除以下账户的全部通行密钥：',
    passkeysAlreadyClear: '此账户当前尚未绑定任何通行密钥。',
    recoveryHint: '重置密码后请通过线下安全渠道交付给宗亲。重置密码或双重验证将立即注销该账户其他设备的会话。',
    permLivingPii: '查看在世宗亲隐私及地址',
    permElderSealed: '查看长老密录及家族遗训',
    permEditLineage: '编辑及新增世系谱录',
    permExportVault: '导出 .zupu 加密备份文件',
    permInviteRelatives: '签发宗亲验证邀请码',
    permManageRoles: '管理宗亲角色与权限',
    issueInviteTitle: '签发一次性宗亲邀请码',
    issueInviteDesc: '先为宗亲绑定角色与房份权限并生成验证码，再通过线下安全渠道交付家族加密主密码。',
    relEngName: '宗亲英文姓名',
    relZhName: '宗亲中文姓名',
    boundEmail: '指定邮箱（选填）',
    assignedRole: '指派角色',
    genInviteBtn: '生成一次性邀请码',
    generatingBtn: '正在生成邀请码……',
    inviteReady: '一次性宗亲邀请码已就绪（仅显示这一次）',
    issuedInvitesTitle: '已签发的邀请记录',
    noInvites: '暂未签发任何宗亲邀请码。',
    redeemedOn: '已于以下日期兑换：',
    expiresOn: '有效期至：',
    auditTitle: '宗族保管及访问审计日志',
    eventsCount: '条记录',
    colTime: '时间戳',
    colActor: '操作成员',
    colEvent: '执行动作',
    colTarget: '目标对象',
    colDetail: '详细说明',
    coCustodianBadge: '协管长老',
    transferTitle: '族长传承 · 移交掌谱权限',
    transferDesc: '将宗族最高掌谱「族长」身份移交给一位已验证的在册宗亲。您将平滑转为具备「管理宗亲权限」的协管典藏人。',
    transferTargetLabel: '指定接任族长之宗亲',
    transferPasswordLabel: '确认现任族长登录密码',
    transferTotpLabel: '6 位 TOTP 动态验证码',
    transferConfirmPrompt: '确定要将宗族最高「族长」权限移交给此宗亲吗？此操作将永久记录于家族审计日志。',
    transferBtn: '移交族长权限',
    transferConfirmBtn: '确认移交族长',
    transferringBtn: '正在移交……',
    transferSuccessPrefix: '已将族长保管权限移交予',
    noEligibleSuccessor: '请先邀请并验证至少一位其他在册宗亲，方可进行族长移交。',
  },
  mfa: {
    kicker: '双重验证与密钥 · 加密与身份加固',
    title: '双重验证（MFA）与加密主密钥',
    authenticatorSubtitle: 'RFC 6238 动态验证器',
    cardTitle: '双重身份验证（TOTP）',
    activeBadge: '已启用 MFA',
    notEnrolledBadge: '尚未启用',
    offlineNote: '账户级 TOTP 双重验证适用于连接至家族服务器节点时；在纯离线模式下，本地 IndexedDB 家谱直接受 PBKDF2 + AES-256-GCM 家族加密主密码保护。',
    activeDesc: '每次登录此家族节点均须输入 6 位 TOTP 动态验证码，或未使用过的一次性备用恢复码。',
    recoveryTitle: '请妥善离线保存备用恢复码',
    recoveryDesc: '请将下列恢复码存放于实体保险箱，每组仅可使用一次，以防验证器设备遗失。',
    disableTitle: '停用 TOTP 双重验证',
    disableBtn: '停用双重验证',
    enrollDesc: '使用每 30 秒刷新的 6 位动态验证码保护您的宗亲账户（支持 Google Authenticator、1Password、Authy 或硬件令牌）。',
    enrollBtn: '启用 TOTP 动态验证器',
    step1: '1. 请使用验证器扫描此二维码，或手动输入 Base32 密钥。',
    step2: '2. 输入验证器显示的 6 位代码以完成启用',
    verifyActivateBtn: '验证并启用',
    rotateKeyTitle: '轮换家族 AES-256 加密主密码',
    rotateKeyDesc: '在本地重新使用全新随机盐值及 310,000 次 PBKDF2 算法重新加密全部谱录。',
    reEncryptBtn: '重新加密宗族保险库',
    currentPassphraseLabel: '当前家族加密主密码',
    newPassphraseLabel: '新家族加密主密码（至少 8 个字符）',
    confirmNewPassphraseLabel: '确认新加密主密码',
    currentPassphraseRequiredError: '请输入当前的家族加密主密码。',
    currentPassphraseInvalidError: '当前的家族加密主密码不正确。',
    passphraseUnchangedError: '新加密主密码不能与当前密码相同。',
    passphraseMinLengthError: '新家族加密主密码需至少包含 8 个字符。',
    passphraseMismatchError: '两次输入的新加密主密码不一致。',
    rotateConfirmPrompt: '确定要使用新主密码重新加密全部谱录吗？其他宗亲下次解锁时需改用新主密码。',
    rotateConfirmBtn: '确认重新加密',
    rotateCustodianOnlyNote: '仅族长或获授「管理宗亲权限」的账户可轮换家族加密主密码。',
    rotateBackupPromptTitle: '主密码已轮换 · 请更新离线备份',
    rotateBackupPromptDesc: '旧版 .zupu.json 备份仍使用旧主密码加密。建议立即下载新版加密备份文件与继承人交接凭证，并通过私密渠道通知已验证宗亲。',
    downloadUpdatedArchiveBtn: '下载 .zupu.json 备份',
    archiveExportedNotice: '已下载最新加密 .zupu.json 备份文件。',
    changePwTitle: '更改账户登录密码',
    updatePwBtn: '更新登录密码',
    custodySheetTitle: '继承人密钥交接凭证（Heir Custody Sheet）',
    custodySheetDesc: '在浏览器本地排版生成 A4 典藏版实体交接单，内含密钥指纹、服务器网址、两人分段保管手写栏及紧急恢复清单。',
    custodySheetBtn: '下载交接凭证 PDF',
    custodySheetGenerating: '正在排版生成交接单……',
    custodySheetSuccess: '已下载继承人密钥交接凭证 PDF。',
    passkeySubtitle: 'FIDO2 / WebAuthn 硬件与生物识别密钥',
    passkeyTitle: '通行密钥 Passkeys',
    passkeyCountBadge: '已绑定',
    passkeyNoneBadge: '尚未绑定',
    passkeyDesc: '可为同一账户绑定多组通行密钥（如 MacBook Touch ID、iPhone Face ID、Windows Hello 或 YubiKey 硬件安全密钥），实现抗钓鱼免密登录。',
    passkeyOfflineNote: '通行密钥用于验证并登录家族服务器节点；纯离线模式下仅由本地加密主密码保护 IndexedDB。',
    passkeyLabelPlaceholder: '设备名称（例如：MacBook Touch ID、YubiKey 5C）',
    passkeyAddBtn: '添加通行密钥',
    passkeyAddingBtn: '等待设备授权……',
    passkeyDeviceMulti: '跨设备同步密钥',
    passkeyDeviceSingle: '单设备／硬件密钥',
    passkeyBackedUp: '已备份',
    passkeyAddedOn: '添加于',
    passkeyLastUsed: '最近使用',
    passkeyNeverUsed: '尚未使用',
    passkeyRenameBtn: '重命名',
    passkeySaveNameBtn: '保存',
    passkeyRemoveBtn: '移除',
    passkeyConfirmRemoveBtn: '确认移除',
    passkeyMaxNote: '每位宗亲账户最多可绑定 10 组通行密钥。',
    passkeyAddedNotice: '已添加通行密钥：',
    passkeyRenamedNotice: '已更新通行密钥名称。',
    passkeyRemovedNotice: '已从账户移除该通行密钥。',
    passkeyUnsupported: '当前浏览器或环境不支持 WebAuthn 通行密钥。',
    showSecretAria: '显示密码',
    hideSecretAria: '隐藏密码',
    generateDicewareBtn: '生成 5 词密码',
    strengthWeak: '弱',
    strengthFair: '尚可',
    strengthGood: '良好',
    strengthStrong: '极强',
    autoLockTitle: '闲置自动锁定与设备会话管理',
    autoLockDesc: '在指定闲置时间后自动清除浏览器内存中的解密密钥，并可随时查看或注销其他设备会话。',
    autoLockLabel: '闲置自动锁定时限',
    autoLockOff: '停用（仅手动锁定）',
    autoLockMinutesSuffix: '分钟',
    autoLockNotice: '因闲置超时，宗族秘藏已自动锁定。',
    sessionsTitle: '当前有效登录会话',
    sessionsDesc: '持有您账户有效会话凭证的浏览器或设备。',
    sessionsCurrentBadge: '当前设备',
    sessionsRevokeOthersBtn: '注销全部其他设备',
    sessionsRevokingBtn: '正在注销……',
    sessionsRevokeOneBtn: '撤销会话',
    sessionsEmpty: '暂无其他有效登录设备。',
    sessionsRevokedNotice: '已强制注销所有其他设备会话。',
    signInAlertsTitle: '近期登录安全记录',
    signInAlertsEmpty: '暂无近期登录活动记录。',
    sessionLastSeen: '最后活动',
  },
  offline: {
    kicker: '离线备份与主权 · 本地 IndexedDB 及冷备份',
    title: '离线存储与家族数据主权',
    hybridTitle: '混合主权同步',
    hybridDesc: 'AES-256-GCM 加密谱录会自动镜像存储于本地 IndexedDB 以备离线查阅，同时将密文信封同步至家族私密服务器供已验证宗亲访问。',
    airgapTitle: '气隙隔离纯离线保险库',
    airgapDesc: '所有谱系编辑均零网络传输，加密数据仅留存于此设备浏览器的 IndexedDB 内，直至您手动导出加密备份文件。',
    selected: '当前模式',
    switchLabel: '切换至此模式',
    archiveTitle: '便携式加密备份文件（.zupu.json）',
    archiveDesc: '下载包含 SHA-256 完整性校验码的加密家谱归档文件，方便存入 U 盘或家族保险箱作冷备份。仅持有家族加密主密码者方可解密。',
    pendingWarning: '本地 IndexedDB 尚有未推送至家族服务器的加密变更。',
    pushSyncBtn: '立即推送同步',
    exportBtn: '导出加密 .zupu 备份',
    restoreFileBtn: '导入还原 .zupu 文件',
    snapshotsTitle: '浏览器本地 IndexedDB 加密快照',
    snapshotsDesc: '存储于此设备的各时间点加密备份快照。',
    snapshotPlaceholder: '快照标签（例如：2026 清明修谱）',
    saveSnapshotBtn: '创建本地快照',
    noSnapshots: '暂无本地快照，建议在大规模修谱前先创建加密快照。',
    restoreBtn: '还原此快照',
    interchangeTitle: '批量 CSV 与 GEDCOM (5.5.1) 导入／导出',
    interchangeDesc: '将授权范围内的宗亲谱录导出为支持中文的 UTF-8 CSV 电子表格或国际标准 GEDCOM (.ged) 家谱格式，或将现有家族名册批量导入并加密封存至宗族保险库。',
    exportCsvBtn: '导出 CSV 清册',
    exportGedcomBtn: '导出 GEDCOM',
    importInterchangeBtn: '导入 CSV / GEDCOM',
    csvExportedNotice: '已按权限导出 UTF-8 CSV 宗亲清册',
    gedExportedNotice: '已按权限导出 GEDCOM 5.5.1 家谱文件',
    importPreviewPrefix: '已解析共',
    importPreviewSuffix: '条谱录，准备加密并存入此保险库。',
    mergeImportBtn: '合并导入保险库',
    replaceImportBtn: '覆盖全部谱录',
    importCommittedNotice: '已将导入谱录完成 AES-256-GCM 加密并保存',
    serverHistoryTitle: '服务器历史版本记录（最近 5 次修订）',
    serverHistoryDesc: '每次推送同步、轮换主密码或回滚前均会自动封存上一版本。',
    serverHistoryEmpty: '服务器暂未存有先前修订版本。',
    rollbackBtn: '回滚此版本',
    confirmRollbackBtn: '确认回滚',
    rollbackSuccess: '已将服务器谱库回滚至修订版本',
    autoSnapshotHint: '在轮换主密码或批量导入前，系统会自动在下方创建本地保护快照。',
  },
  forcePw: {
    kicker: '掌谱人已重置密码 · 强制安全更新',
    title: '设置您的个人登录密码',
    descPrefix: '宗族掌谱人已为',
    descSuffix: '设置临时登录密码。请先更换为您私人的密码，方可解锁并查阅宗族加密谱牒。',
    tempPasswordLabel: '当前临时密码',
    tempPasswordPlaceholder: '输入刚才登录使用的临时密码',
    newPasswordLabel: '设置个人新密码（至少 8 位字符）',
    newPasswordPlaceholder: '输入安全的个人登录密码',
    confirmPasswordLabel: '确认新密码',
    submitBtn: '更新个人密码并继续',
    savingBtn: '正在更新密码……',
    differentError: '新密码不能与掌谱人发出的临时密码相同。',
    mismatchError: '两次输入的新密码不一致。',
    securityNote: '更新个人密码后将自动注销旧临时会话，且不影响家族保险库 AES-256 加密主密码。',
  },
  chronology: {
    kicker: '世代统计与纪年 · Lineage Demographics & Historical Span',
    title: '宗族世系统计与纪年总览',
    metricRecords: '授权可见谱录',
    metricGenerations: '已登记世代数',
    metricSpan: '生年纪年跨度',
    recordedBirthSpan: '最早至最近登记的出生年份',
    metricUnions: '已登记姻亲联姻',
    activeBranchesSuffix: '个在册房份',
    genBreakdownTitle: '各世代人数与在世比例',
    genBreakdownDesc: '按字辈诗世代顺序统计先祖与在世宗亲分布',
    branchBalanceTitle: '房别支脉分布（房别）',
    migrationTitle: '祖籍源流与现居地分布',
    ancestralTownsLabel: '祖籍／出生地记载',
    livingHubsLabel: '在世宗亲聚居地',
    timelineTitle: '历代人物生平纪年脉络',
    timelineDesc: '按出生年份先后排列授权谱录（点击任意成员即可查看详情）',
    memorialTitle: '先祖忌辰与寿诞日历（农历／公历换算）',
    memorialDesc: '自动推算未来一年内之农历忌辰、生辰及清明重阳节日（严格套用在世隐私权限）。',
    memorialFilterAll: '全部追思纪念',
    memorialFilterDeath: '先祖忌辰',
    memorialFilterBirth: '寿诞／冥寿',
    memorialFilterFestival: '宗族节日',
    memorialExportIcs: '导出 .ics 日历',
    memorialIcsSuccess: '已导出宗族忌辰寿诞 .ics 日历文件',
    memorialEmpty: '当前筛选范围内暂无已登记日期的追思或节日。',
    memorialToday: '今日',
    memorialTomorrow: '明日',
    memorialInDaysPrefix: '尚余',
    memorialInDaysSuffix: '日',
  },
  pdf: {
    exportBtn: '导出 PDF',
    modalKicker: '典藏修谱版 · 客户端本地实时排版',
    modalTitle: '导出宗族家谱 PDF',
    modalDesc: '在浏览器本地实时排版生成 A4 典藏版 PDF，并严格依照您当前的宗亲权限过滤敏感数据。',
    branchLabel: '导出房份范围',
    includeTree: '包含卷首封面与世系总图',
    includeLivingPii: '包含在世宗亲现居地址（隐私资料）',
    livingPiiRestricted: '权限受限（在世地址将自动遮蔽）',
    includeSealed: '包含长老密录与遗训（长老密录）',
    sealedRestricted: '权限受限（长老密录将自动隐藏）',
    recordsPreview: '本次导出收录谱录数：',
    downloadBtn: '下载家谱 PDF',
    generatingBtn: '正在排版生成 PDF……',
    successNotice: '已下载典藏版家谱 PDF。',
    coverKicker: '宗族世系 · 私密典藏修谱版',
    exportedBy: '导出宗亲',
    exportedAt: '制谱时间',
    recordsCount: '收录人数',
    treeHeading: '宗族世系总图',
    chroniclesHeading: '欧阳体世系详录',
    redactedAddress: '【在世隐私地址已依权限遮蔽】',
    confidentialFooter: '宗族私密谱牒 · 仅限授权宗亲查阅',
    pageLabel: '页次',
    pdfACompliant: '以典藏级 PDF/A-1b（ISO 19005-1）格式导出',
    pdfACompliantHint: '内嵌 sRGB ICC 色彩配置文件与 XMP 归档元数据，确保跨世代长期保存兼容。',
  },
  audit: {
    openBtn: '重复与关联检查',
    modalKicker: '世系完整性稽核与合并去重',
    modalTitle: '重复成员合并与世系关联修复',
    modalDesc: '扫描已解密谱录，检测疑似重复登记的宗亲、单向配偶关联或失效的父母／配偶编号。',
    duplicatesHeading: '疑似重复成员配对',
    noDuplicates: '暂未发现疑似重复的宗亲记录。',
    keepLeftBtn: '保留左侧并合并',
    keepRightBtn: '保留右侧并合并',
    linkIssuesHeading: '世系关联异常检查',
    noLinkIssues: '所有父母与配偶关联均已双向对称且有效。',
    repairAllBtn: '一键修复全部关联异常',
    issueAsymmetricSpouse: '单向配偶关联（对方谱录未列出此配偶）',
    issueDanglingParent: '失效的父母编号参照（对应谱录已移除或不存在）',
    issueDanglingSpouse: '失效的配偶编号参照（对应谱录已移除或不存在）',
    allCleanTitle: '世系数据完整无误',
    allCleanDesc: '当前授权谱录中未发现重复成员或断裂的世系关联。',
    mergeSuccess: '已完成重复记录合并并自动重新关联子女及配偶。',
    repairSuccess: '已自动修复所有断裂或单向的世系关联。',
    busyLabel: '正在更新加密保险库……',
  },
  conflict: {
    kicker: '乐观版本锁定 · HTTP 409 版本冲突',
    title: '服务器端家谱已有较新修订版本',
    desc: '在您开启此会话后，另有掌谱人已向服务器同步较新的加密版本。请选择重新加载最新版本或强制覆盖服务器数据：',
    reloadBtn: '重新加载服务器最新版',
    forceBtn: '以本机版本覆盖服务器',
    reloadingBtn: '正在加载最新加密版本……',
    forcingBtn: '正在强制覆盖……',
    revisionLabel: '服务器版本号',
  },
};

const DICTIONARIES: Record<Locale, TranslationDict> = {
  'en-HK': EN_HK,
  'zh-HK': ZH_HK,
  'zh-CN': ZH_CN,
};

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en-HK';
  const lang = (navigator.language || '').toLowerCase();
  if (lang.includes('hant') || lang === 'zh-hk' || lang === 'zh-tw' || lang === 'zh-mo') {
    return 'zh-HK';
  }
  if (lang.includes('hans') || lang === 'zh-cn' || lang === 'zh-sg' || lang === 'zh') {
    return 'zh-CN';
  }
  return 'en-HK';
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: TranslationDict;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en-HK',
  setLocale: () => undefined,
  t: EN_HK,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(detectBrowserLocale);

  useEffect(() => {
    getLocalePreference()
      .then((saved) => {
        if (saved) setLocaleState(saved);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    setLocalePreference(next).catch(() => undefined);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: DICTIONARIES[locale] }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
