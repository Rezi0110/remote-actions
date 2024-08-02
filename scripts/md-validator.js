#!/usr/bin/env node

const showdown = require("showdown");
const fs = require("fs");
const markdownlint = require("markdownlint");
const args = process.argv.slice(2);
const folder = args?.[0] + "/docs";
const {
  enrichHTMLFromMarkup,
  showdownHighlight,
  mdExtension,
} = require("./utils/md-utils");
const { errorMessage, errorMsg, printMessage } = require("./utils/tools");
let urlsArr = [];

const converter = new showdown.Converter({
  ghCompatibleHeaderId: true,
  emoji: true,
  disableForced4SpacesIndentedSublists: true,
  literalMidWordUnderscores: true,
  tables: true,
  extensions: [enrichHTMLFromMarkup(), showdownHighlight, mdExtension],
});
converter.addExtension(() => {
  return [
    {
      type: "output",
      regex: /<a\shref[^>]+>/g,
      replace: function (text) {
        const url = text.match(/"(.*?)"/)[1];
        if (url.startsWith("http:") || url.startsWith("https:")) {
          urlsArr.push(url);
          return '<a href="' + url + '" target="_blank">';
        }
        return text;
      },
    }
  ];
}, "externalLink");

converter.addExtension(() => {
  return [
  {
    type: 'output',
    filter: function (htmlContent) {
        const imgRegex = /<img.*?src=["'](.*?)["']/g;
        let match;
        while ((match = imgRegex.exec(htmlContent)) !== null) {
          urlsArr.push(match[1]);
        }
        return htmlContent;
    }
  }
  ]
}, "extractImageUrls");

const markdownlinter = async (dir) => {
  fs.readdir(dir, { withFileTypes: true }, (err, files) => {
    files.forEach(async (file) => {
      if (file?.isDirectory()) {
        markdownlinter(`${dir}/${file.name}`);
      } else if (/\.md$/.test(file?.name)) {
        try {
          let fileName = `${dir}/${file.name}`;
          const options = {
            files: [fileName],
            config: {
              default: true,
              "no-hard-tabs": false,
              whitespace: false,
              line_length: false,
            },
          };
          // const result = markdownlint.sync(options);
          markdownlint(options, function callback(err, result) {
            if (!err) {
              if (result.toString().length > 0) {
                errorMessage(
                  "MD LINTER",
                  `PLEASE CHECK FOLLOWING LINTER ISSUES WITHIN THE FILE : ${fileName}`
                );
                printMessage(result);
              } else {
                printMessage(`${fileName} - LINTER PASSED`);
              }
            }
          });
        } catch (e) {
          errorMessage("MD LINTER", e.message);
        }
      } else {
        errorMessage(
          "MD LINTER",
          `Invalid subdir or file extension : ${dir}/${file.name}`
        );
      }
    });
  });
};

const mdHtmlValidator = async (dir) => {
  fs.readdir(dir, { withFileTypes: true }, (err, files) => {
    files?.forEach(async (file) => {
      if (file?.isDirectory()) {
        check = mdHtmlValidator(`${dir}/${file.name}`);
      } else if (/\.md$/.test(file?.name)) {
        try {
          let check = true;
          let fileName = `${dir}/${file.name}`;
          const content = fs.readFileSync(fileName, "utf8");
          const htmlData = converter.makeHtml(content);

          urlsArr.forEach(url => {
            if (/githubusercontent|github\.com\/Fiserv.*(\/raw\/|\/files\/)/.test(url)) {
              if (/\.(png|jpg|jpeg)$/.test(url))
                errorMsg(`> ${url} is a raw github image link. Please utilize '/assets/images' instead.`);
              else
                errorMsg(`> ${url} is a github fetch link. Please utilize '/assets' instead for file uploads.`);
              check = false;
              return;
            }
          });
          if (check) {
            printMessage(`${fileName} - HTML VALIDATOR PASSED`);
          } else {
            errorMessage('HTML VALIDATOR', `PLEASE FIX LINK RELATED ISSUES WITHIN THE FILE : ${fileName}`);
          }
          urlsArr = [];
        } catch (e) {
          errorMessage("HTML VALIDATOR", e.message);
          urlsArr = [];
        }
      } else {
        errorMessage("HTML VALIDATOR", "Invalid subdir or Not a markdown file.");
        urlsArr = [];
      }
    });
  });
};

const main = async () => {
  try {
    printMessage(`External Dir ---->>> ${args}`);
    if (args?.length > 0) {
      await markdownlinter(folder);
      await mdHtmlValidator(folder);
    } else {
      errorMessage("MD VALIDATOR", "No Path for docs dir. defined");
    }
  } catch (e) {
    errorMessage("MD VALIDATOR", e.message);
  }
};

if (require.main === module) {
  main();
}