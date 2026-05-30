/**
 * Conventional Commits — règles imposées au commit-msg hook.
 * Cf. BRANCHING.md section "Conventional Commits".
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Types autorisés (alignés avec BRANCHING.md)
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'security',
        'chore',
        'docs',
        'test',
        'ci',
        'perf',
        'refactor',
        'style',
        'build',
        'revert'
      ]
    ],
    // Sujet : pas de point final, minuscule
    'subject-full-stop': [2, 'never', '.'],
    'subject-case': [2, 'always', ['sentence-case', 'lower-case']],
    // Longueur header (titre PR friendly)
    'header-max-length': [2, 'always', 100],
    // Pas de scope obligatoire mais en lowercase si fourni
    'scope-case': [2, 'always', 'lower-case']
  }
}
