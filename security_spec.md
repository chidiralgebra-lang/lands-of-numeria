# Security Specification & TDD Plan (`LANDS of NUMERIA`)

## 1. Data Invariants
1. **Admin Authority (`gameConfig/global`)**: Only verified admin (`request.auth.token.email == 'chidiralgebra@gmail.com' && request.auth.token.email_verified == true`) may create, update, or delete `gameConfig/global`. Students may `get` `gameConfig/global` only after verified Google authentication, and `list` on `gameConfig` is always denied.
2. **Secret & PIN Isolation (`teacherPrivate/{userId}`)**: `teacherPin` is stripped from `gameConfig/global` (`!('teacherPin' in data.settings)`) and isolated to `teacherPrivate/{userId}`, readable and writable solely by the matching verified admin owner.
3. **Profile Privacy & Anti-Role-Escalation (`users/{userId}`)**: User profiles containing `email` are readable only by the owner or verified admin. Self-registration forces `role == 'student'` (unless verified admin), and non-admin users cannot escalate `role` or tamper with `uid` or `createdAt`.
4. **Attempt Integrity (`attempts/{attemptId}`)**: Authenticated verified users can only `create` attempts with `ownerUid == request.auth.uid`, server `request.time` timestamps, bounded numeric metrics, and strict allowlisted keys. Only verified admin can `update` (for essay rubric grading) or `delete` attempts. Students can `list` only their own records (`resource.data.ownerUid == request.auth.uid`).
5. **Classroom Master Gate (`classRooms/{roomCode}/participants/{participantId}`)**: Only verified admin can create/start/end/delete `classRooms/{roomCode}`. Participants can only join non-ended rooms under their own `uid`, cannot inflate initial scores on `create`, and can only update their own gameplay progress while room `status == 'ACTIVE'`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on `gameConfig/global`**: Adding `{ isAdminOverride: true }` or `{ settings: { teacherPin: "0000" } }` during update -> `PERMISSION_DENIED`.
2. **Student Config Tampering**: Verified student account (`student@gmail.com`) attempting `setDoc` on `gameConfig/global` -> `PERMISSION_DENIED`.
3. **Unverified Email Spoofing**: Account claiming admin email with `email_verified: false` -> `PERMISSION_DENIED`.
4. **Cross-User PII Read on `users/{otherUid}`**: Verified student attempting `getDoc(doc(db, 'users', 'teacherUid'))` -> `PERMISSION_DENIED`.
5. **Self-Assigned Privilege Escalation on `users/{uid}`**: Creating profile with `{ role: 'teacher' }` as a non-admin -> `PERMISSION_DENIED`.
6. **Attempt Ownership Spoofing**: Creating `attempts/att1` with `{ ownerUid: 'victim-uid' }` -> `PERMISSION_DENIED`.
7. **Unbounded Array Resource Exhaustion**: Writing `attempts/att2` with `questionLogs` of length 250 or `gameConfig/global` with 600 questions -> `PERMISSION_DENIED`.
8. **Malicious Document ID Poisoning**: Creating `attempts/bad$id/../../../x` or 200-char random ID -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: Creating `attempts/att3` with custom past `createdAt` instead of `serverTimestamp()` -> `PERMISSION_DENIED`.
10. **Blanket List Query Scraping on `attempts`**: Student calling `getDocs(collection(db, 'attempts'))` without `where('ownerUid', '==', uid)` -> `PERMISSION_DENIED`.
11. **Initial Score Inflation on `participants`**: Joining room with `{ score: 9999, correctCount: 5 }` -> `PERMISSION_DENIED`.
12. **Ended Room Mutation**: Updating `participants/{uid}` after `classRooms/{roomCode}.status == 'ENDED'` -> `PERMISSION_DENIED`.

## 3. Verification Runner Reference (`firestore.rules.test.ts` pattern)
All 12 payloads above are enforced deterministically by:
- `isVerifiedUser()` (`request.auth != null && request.auth.token.email_verified == true`)
- `isAdmin()` (`isVerifiedUser() && request.auth.token.email == 'chidiralgebra@gmail.com'`)
- `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, length `1..128`)
- `isValidGameConfig`, `isValidUserProfile`, `isValidTeacherPrivate`, `isValidAttempt`, `isValidClassRoom`, `isValidParticipant` using strict `keys().hasAll(...)` + `keys().hasOnly(...)` + `affectedKeys().hasOnly(...)` + `request.time`.
