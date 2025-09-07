%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <emscripten.h>
#include "cJSON.h"

// --- Forward Declarations ---
int yylex(void); void yyerror(const char *s); int yyparse(void);
typedef struct yy_buffer_state *YY_BUFFER_STATE;
YY_BUFFER_STATE yy_scan_string(const char * str);
void yy_delete_buffer(YY_BUFFER_STATE b);

#define OUTPUT_BUFFER_SIZE 8192
char output_buffer[OUTPUT_BUFFER_SIZE];
cJSON *portfolio_data = NULL;

void safe_strncat(const char* src) {
    if (src) strncat(output_buffer, src, OUTPUT_BUFFER_SIZE - strlen(output_buffer) - 1);
}

const char* get_string(cJSON* obj, const char* key) {
    cJSON* item = cJSON_GetObjectItem(obj, key);
    return (item && cJSON_IsString(item)) ? item->valuestring : "N/A";
}

void format_about(cJSON* about_obj) {
    safe_strncat("\n--- About Me ---\n\n");
    safe_strncat(get_string(about_obj, "content"));
    safe_strncat("\n");
}

void format_projects(cJSON* projects_array) {
    safe_strncat("\n--- Projects ---\n\n");
    cJSON* project = NULL;
    cJSON_ArrayForEach(project, projects_array) {
        char buffer[2048];
        snprintf(buffer, sizeof(buffer),
                 "Title: %s (%s)\nDesc:  %s\nLink:  %s\n\n",
                 get_string(project, "title"), get_string(project, "subtitle"),
                 get_string(project, "description"), get_string(project, "github"));
        safe_strncat(buffer);
    }
}

void format_experience(cJSON* experiences_array) {
    safe_strncat("\n--- Professional Experience ---\n\n");
    cJSON* exp = NULL;
    cJSON_ArrayForEach(exp, experiences_array) {
        char buffer[512];
        snprintf(buffer, sizeof(buffer), "%s at %s (%s)\n",
                 get_string(exp, "title"), get_string(exp, "company"), get_string(exp, "duration"));
        safe_strncat(buffer);
        cJSON* desc_items = cJSON_GetObjectItem(exp, "description");
        cJSON* item = NULL;
        cJSON_ArrayForEach(item, desc_items) {
            safe_strncat("  - ");
            safe_strncat(item->valuestring);
            safe_strncat("\n");
        }
        safe_strncat("\n");
    }
}

void format_skills(cJSON* skills_obj) {
    safe_strncat("\n--- Technical Skills ---\n");
    const char* categories[] = {"languages", "frameworks_libraries", "tools_platforms", "concepts", NULL};
    const char* titles[] = {"Languages", "Frameworks & Libraries", "Tools & Platforms", "Concepts"};
    for (int i = 0; categories[i] != NULL; i++) {
        char title[128];
        snprintf(title, sizeof(title), "\n%s:\n  ", titles[i]);
        safe_strncat(title);
        cJSON* items = cJSON_GetObjectItem(skills_obj, categories[i]);
        cJSON* item = NULL;
        int count = 0;
        cJSON_ArrayForEach(item, items) {
            safe_strncat(item->valuestring);
            if (count < cJSON_GetArraySize(items) - 1) safe_strncat(", ");
            count++;
        }
    }
    safe_strncat("\n\n");
}

void format_education(cJSON* edu_obj) {
    safe_strncat("\n--- Education ---\n\n");
    char buffer[512];
    // --- FIX: Use correct field names ---
    snprintf(buffer, sizeof(buffer), "%s\n%s\nExpected Graduation: %s\n",
             get_string(edu_obj, "degree"),
             get_string(edu_obj, "institution"), get_string(edu_obj, "graduation_date"));
    safe_strncat(buffer);
}

void format_awards(cJSON* awards_array) {
    safe_strncat("\n--- Honors and Awards ---\n\n");
    cJSON* award_item = NULL;
    cJSON_ArrayForEach(award_item, awards_array) {
        // --- FIX: Use correct field names ---
        safe_strncat("  - ");
        safe_strncat(get_string(award_item, "award"));
        safe_strncat(", ");
        safe_strncat(get_string(award_item, "event"));
        safe_strncat(" (");
        safe_strncat(get_string(award_item, "date"));
        safe_strncat(")\n");
    }
}

void format_contact(cJSON* contact_obj) {
    safe_strncat("\n--- Contact Information ---\n\n");
    char buffer[512];
    // --- FIX: Use correct field names ---
    snprintf(buffer, sizeof(buffer), "Email:    %s\nLinkedIn: %s\nGitHub:   %s\n",
             get_string(contact_obj, "email"), get_string(contact_obj, "linkedin"), get_string(contact_obj, "github_profile"));
    safe_strncat(buffer);
}

void handle_section_command(const char* section) {
    cJSON* data = cJSON_GetObjectItem(portfolio_data, section);
    if (!data) {
        snprintf(output_buffer, OUTPUT_BUFFER_SIZE, "\nError: Section '%s' not found.\n", section);
        return;
    }
    if (strcmp(section, "about") == 0) format_about(data);
    else if (strcmp(section, "projects") == 0) format_projects(data);
    else if (strcmp(section, "experience") == 0) format_experience(data);
    else if (strcmp(section, "skills") == 0) format_skills(data);
    else if (strcmp(section, "education") == 0) format_education(data);
    else if (strcmp(section, "awards") == 0) format_awards(data);
    else if (strcmp(section, "contact") == 0) format_contact(data);
    else {
        snprintf(output_buffer, OUTPUT_BUFFER_SIZE, "\nError: Display logic for '%s' is not implemented.\n", section);
    }
}

EMSCRIPTEN_KEEPALIVE
const char* process_command(const char* command_str, const char* json_data_str) {
    output_buffer[0] = '\0';
    if (portfolio_data) cJSON_Delete(portfolio_data);
    portfolio_data = cJSON_Parse(json_data_str);
    if (portfolio_data == NULL) { snprintf(output_buffer, OUTPUT_BUFFER_SIZE, "Error: Failed to parse internal portfolio data."); return output_buffer; }
    YY_BUFFER_STATE buffer = yy_scan_string(command_str);
    yyparse();
    yy_delete_buffer(buffer);
    cJSON_Delete(portfolio_data);
    portfolio_data = NULL;
    return output_buffer;
}
%}

%union { char *str; }
%token <str> T_IDENTIFIER
%token T_CAT T_ECHO T_HELP T_CLEAR T_EOL

%%
input: | input line;
line: T_EOL | command T_EOL;
command:
      T_CAT T_IDENTIFIER { handle_section_command($2); free($2); }
    | T_ECHO T_IDENTIFIER { handle_section_command($2); free($2); }
    | T_HELP { safe_strncat("\n--- Portfolio Terminal Help ---\nUsage: cat [section]\n\nAvailable commands:\n  cat, echo        Display content of a section.\n  help             Show this help message.\n  clear, cls       Clear the terminal screen.\n\nAvailable sections:\n  - about\n  - projects\n  - skills\n  - experience\n  - education\n  - awards\n  - contact\n"); }
    | T_CLEAR { strncpy(output_buffer, "COMMAND_CLEAR", OUTPUT_BUFFER_SIZE); }
    ;
%%
void yyerror(const char *s) {
    if (strlen(output_buffer) == 0) {
        snprintf(output_buffer, OUTPUT_BUFFER_SIZE, "\nError: Invalid syntax. Type 'help' for usage.\n");
    }
}
