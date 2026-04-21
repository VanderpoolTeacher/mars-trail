// Slide manifest. All HTML in `title`, `body`, and `snippets[].caption` is
// authored in-repo and trusted — rendered unescaped. Snippet `code` contains
// literal source text and is escaped at render time. Do not route user input
// through this file.
export const spine = [
  {
    id: 'welcome',
    title: 'Welcome to the Mars Trail code tour',
    body: '<p>Press → or click NEXT to begin.</p>',
  },
  {
    id: 'pitch',
    title: 'What is Mars Trail?',
    body: '<p>Placeholder — real content arrives in Task 6.</p>',
    snippets: [
      {
        path: 'src/main.js',
        lines: [1, 10],
        caption: 'Placeholder snippet (replaced in Task 7)',
        code: '// first lines of main.js will go here\nconsole.log("hello mars");',
      },
    ],
  },
];
