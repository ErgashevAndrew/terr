КУДА РАСКЛАДЫВАТЬ ФАЙЛЫ

В корне проекта должны лежать:
- index.html
- папка css
- папка js
- папка menu
- папка fonts
- папка blocks
- папка Player

Итоговая структура:

terr/
  index.html
  css/
    main.css
    menu.css
    game.css
    debug.css
  js/
    state.js
    assets.js
    menu.js
    world.js
    player.js
    camera.js
    debug.js
    game.js
    main.js
  menu/
    backround.png
    LOGO.png
    longbutton.png
    smallbutton.png
    textbox.png
  fonts/
    7fonts.ru_Booree.ttf
  blocks/
    dirty.png
  Player/
    jump/
      jump.png
    mine/
      mine1.png
      mine2.png
      mine3.png
    stopped/
      stop.png
    walk/
      0.gif
      1.gif
      2.gif
      3.gif

ВАЖНО ПРО ШРИФТ

1. Шрифт подключен из файла:
   fonts/7fonts.ru_Booree.ttf

2. Если шрифт снова не подхватится, сделай проще:
   - переименуй файл в booree.ttf
   - в css/main.css замени строку:
     src: url('../fonts/7fonts.ru_Booree.ttf') format('truetype');
   на:
     src: url('../fonts/booree.ttf') format('truetype');

3. Лучше запускать проект через Live Server в VS Code, а не двойным кликом по html.

ЧТО УЖЕ ЕСТЬ
- модульная структура css/js
- главное меню
- онлайн меню-шаблон
- отдельный список серверов без второго родного скролла
- белый текст на кнопках
- анимация логотипа
- запуск одиночной игры по кнопке Single Mode
- возврат в меню по Esc
- debug панель по P
- показ хитбокса игрока
- зум через Z + колесо

ЧТО ПОКА ЕЩЁ НЕТ
- реального мультиплеера
- хостинга мира
- подключения к серверу

