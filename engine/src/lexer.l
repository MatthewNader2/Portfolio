%{
#include "parser.tab.h"
#include <string.h>
%}

%%

"cat"           { return T_CAT; }
"echo"          { return T_ECHO; }
"help"          { return T_HELP; }
"clear"         { return T_CLEAR; }
"cls"           { return T_CLEAR; } /* Add this line */

[a-zA-Z0-9_]+   { yylval.str = strdup(yytext); return T_IDENTIFIER; }

[ \t]           ;
\n              { return T_EOL; }
.               { /* Ignore other characters */ }

%%

int yywrap(void) {
    return 1;
}
