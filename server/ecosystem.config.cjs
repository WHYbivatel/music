module.exports = {
  apps: [
    {
      name: 'music.esl.kz-api',
      cwd: '/var/www/music.esl.kz/server',
      script: '/var/www/music.esl.kz/server/.venv/bin/uvicorn',
      interpreter: 'none',
      args: 'app.main:app --host 127.0.0.1 --port 3221',
    },
    {
      name: 'music.esl.kz-worker',
      cwd: '/var/www/music.esl.kz/server',
      script: '/var/www/music.esl.kz/server/.venv/bin/python',
      interpreter: 'none',
      args: '-m app.worker',
    },
    {
      name: 'music.esl.kz-dispatcher',
      cwd: '/var/www/music.esl.kz/server',
      script: '/var/www/music.esl.kz/server/.venv/bin/python',
      interpreter: 'none',
      args: '-m app.dispatcher',
    },
  ],
};
