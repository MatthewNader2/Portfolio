%{
#include "parser.tab.h"
#include <string.h>
#include <stdlib.h>
%}

%option noyywrap nounput noinput

%%

"cat"           { return T_CAT; }
"echo"          { return T_ECHO; }
"help"          { return T_HELP; }
"clear"         { return T_CLEAR; }
"cls"           { return T_CLEAR; }
"ls"            { return T_LS; }
"dir"           { return T_LS; }
"whoami"        { return T_WHOAMI; }
"id"            { return T_WHOAMI; }
"date"          { return T_DATE; }
"pwd"           { return T_PWD; }
"history"       { return T_HISTORY; }
"exit"          { return T_EXIT; }

"about"         { return T_SEC_ABOUT; }
"projects"      { return T_SEC_PROJECTS; }
"skills"        { return T_SEC_SKILLS; }
"experience"    { return T_SEC_EXPERIENCE; }
"education"     { return T_SEC_EDUCATION; }
"awards"        { return T_SEC_AWARDS; }
"contact"       { return T_SEC_CONTACT; }

\"([^\"\\]|\\.)*\" {
    size_t len = strlen(yytext);
    char *s = (char*)malloc(len - 1);
    if (s) {
        strncpy(s, yytext + 1, len - 2);
        s[len - 2] = '\0';
        yylval.str = s;
    } else {
        yylval.str = strdup("");
    }
    return T_STRING;
}

[a-zA-Z0-9_\-\.\/@]+ {
    yylval.str = strdup(yytext);
    return T_IDENTIFIER;
}

[ \t]+          ;
\r              ;
\n              { return T_EOL; }

.               {
    yylval.str = strdup(yytext);
    return T_IDENTIFIER;
}

%%
