  const originalTitle = document.title;
  let timer;
  const messages = [
    "👋 We miss you!",
    "🚀 New things are waiting!",
    "🤖 Still here for you!",
    "🎁 Don’t forget to check back!",
    "🌟 Something awesome is here!"
  ];
  let index = 0;

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      timer = setInterval(() => {
        document.title = messages[index];
        index = (index + 1) % messages.length;
      }, 4000);
    } else {
      clearInterval(timer);
      document.title = originalTitle;
      index = 0;
    }
  });
