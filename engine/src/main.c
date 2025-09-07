#include <stdio.h>
#include "main.h"
#include "parser.tab.h"

int main() {
    printf("Matthew's Portfolio Engine v0.2\n");
    printf("Type 'help' for a list of commands.\n");

    do {
        printf("> ");
        fflush(stdout); // Add this line to force the prompt to draw immediately.
        yyparse();
    } while (1);

    printf("\nExiting.\n");
    return 0;
}

void engine_init() {
    // This is a placeholder for now.
}
