import re

with open('app/at/hub/page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Find the trial section
# It starts with the Trial overlay comment and ends (exclusive) with the Trial resolved banner comment
start_marker = '      {/* \u2500\u2500 Trial overlay'
end_marker = '\n      {/* Trial resolved banner */'

s = c.find(start_marker)
e = c.find(end_marker)

if s < 0 or e < s:
    print(f"ERROR: could not find section. s={s}, e={e}")
    exit(1)

old_section = c[s:e]
print(f"Found section at {s}-{e}, length {len(old_section)}")

new_section = '''      {/* \u2500\u2500 Trial fullscreen overlay \u2013 blocks ALL other interactions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
      {trial && trial.phase !== "resolved" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 p-6 bg-yellow-50 overflow-y-auto">
          {/* Header */}
          <div className="text-center">
            <p className="text-5xl mb-2">\u2696\ufe0f</p>
            <h2 className="text-2xl font-black text-yellow-900 tracking-tight">{t.at_trial_banner}</h2>
          </div>

          {/* Defendant card */}
          <div className="bg-white border-2 border-yellow-400 rounded-2xl px-8 py-5 text-center shadow-lg w-full max-w-xs">
            <p className="text-xs text-yellow-600 uppercase tracking-widest mb-1">{t.at_trial_defendant}</p>
            <p className="text-3xl font-black text-gray-900">{trialTarget?.name}</p>
          </div>

          {/* Timer */}
          <div className="text-5xl font-mono font-black text-yellow-700">{trialSecsLeft}s</div>

          {/* Defense phase */}
          {trial.phase === "defense" && (
            <div className="bg-yellow-100 border border-yellow-300 rounded-2xl p-4 w-full max-w-xs text-center">
              {amOnTrial ? (
                <>
                  <p className="text-base font-black text-red-700 mb-1">\ud83c\udfa4 {t.at_trial_defense_hint}</p>
                  <p className="text-sm text-yellow-800">{t.at_trial_defense_phase}</p>
                </>
              ) : (
                <>
                  <p className="text-base font-bold text-yellow-800">
                    {t.at_trial_listen} <span className="font-black">{trialTarget?.name}</span>
                  </p>
                  <p className="text-sm text-yellow-600 mt-1">{t.at_trial_defense_phase}</p>
                </>
              )}
            </div>
          )}

          {/* Voting phase */}
          {trial.phase === "voting" && (
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <p className="text-sm font-bold text-yellow-700 text-center">{t.at_trial_voting_phase}</p>
              {myVote ? (
                <p className="text-sm text-center font-semibold bg-white rounded-xl py-3 border border-yellow-200">
                  {t.at_my_vote}{" "}
                  <span className="font-black">
                    {myVote === "guilty" ? t.at_vote_guilty : t.at_vote_innocent}
                  </span>
                </p>
              ) : (
                trial.targetCode !== code && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleVote("guilty")}
                      disabled={loading === "vote"}
                      className="flex-1 bg-red-500 text-white rounded-xl py-4 font-black text-lg active:scale-95 transition disabled:opacity-50"
                    >
                      {t.at_vote_guilty}
                    </button>
                    <button
                      onClick={() => handleVote("innocent")}
                      disabled={loading === "vote"}
                      className="flex-1 bg-green-500 text-white rounded-xl py-4 font-black text-lg active:scale-95 transition disabled:opacity-50"
                    >
                      {t.at_vote_innocent}
                    </button>
                  </div>
                )
              )}
              <p className="text-xs text-yellow-500 text-center">
                {Object.keys(trial.votes).length} / {state.players.filter((p) => p.alive && p.code !== trial.targetCode).length} votes
              </p>
            </div>
          )}
        </div>
      )}
'''

result = c[:s] + new_section + c[e:]

with open('app/at/hub/page.tsx', 'w', encoding='utf-8') as f:
    f.write(result)

print("SUCCESS - trial section replaced")
