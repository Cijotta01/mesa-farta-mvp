export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'perf',
        'a11y',
        'security',
        'docs',
        'test',
        'chore',
        'build',
        'ci'
      ]
    ],
    'subject-case': [2, 'always', 'sentence-case']
  }
};