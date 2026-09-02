%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <emscripten.h>
#include "cJSON.h"

// --- Forward Declarations ---
int yylex(void);
void yyerror(const char *s);
int yyparse(void);
typedef struct yy_buffer_state *YY_BUFFER_STATE;
YY_BUFFER_STATE yy_scan_string(const char * str);
void yy_delete_buffer(YY_BUFFER_STATE b);

#define OUTPUT_BUFFER_SIZE 65536
static char output_buffer[OUTPUT_BUFFER_SIZE];
static size_t out_len = 0;
static cJSON *portfolio_data = NULL;

void safe_strncat(const char* src) {
    if (!src) return;
    size_t slen = strlen(src);
    if (out_len + slen < OUTPUT_BUFFER_SIZE - 1) {
        memcpy(output_buffer + out_len, src, slen);
        out_len += slen;
        output_buffer[out_len] = '\0';
    }
}

const char* get_string(cJSON* obj, const char* key) {
    if (!obj) return "N/A";
    cJSON* item = cJSON_GetObjectItem(obj, key);
    return (item && cJSON_IsString(item) && item->valuestring) ? item->valuestring : "N/A";
}

void format_about(cJSON* about_obj) {
    safe_strncat("\n--- About Me ---\n\n");
    safe_strncat(get_string(about_obj, "content"));
    safe_strncat("\n");
}

void format_projects(cJSON* projects_array) {
    safe_strncat("\n--- Projects ---\n");
    if (!projects_array || !cJSON_IsArray(projects_array)) {
        safe_strncat("No projects found.\n");
        return;
    }
    cJSON* project = NULL;
    cJSON_ArrayForEach(project, projects_array) {
        const char* title = get_string(project, "title");
        const char* subtitle = get_string(project, "subtitle");
        const char* desc = get_string(project, "description");
        const char* link = get_string(project, "github");

        safe_strncat("\n");
        safe_strncat(title);
        if (subtitle && strlen(subtitle) > 0 && strcmp(subtitle, "N/A") != 0) {
            safe_strncat(" (");
            safe_strncat(subtitle);
            safe_strncat(")");
        }
        safe_strncat("\n");
        if (desc && strlen(desc) > 0 && strcmp(desc, "N/A") != 0) {
            safe_strncat("Desc: ");
            safe_strncat(desc);
            safe_strncat("\n");
        }
        if (link && strlen(link) > 0 && strcmp(link, "N/A") != 0) {
            safe_strncat("Link: ");
            safe_strncat(link);
            safe_strncat("\n");
        }
    }
}

void format_experience(cJSON* experiences_array) {
    safe_strncat("\n--- Professional Experience ---\n");
    if (!experiences_array || !cJSON_IsArray(experiences_array)) {
        safe_strncat("No experience records found.\n");
        return;
    }
    cJSON* exp = NULL;
    cJSON_ArrayForEach(exp, experiences_array) {
        const char* title = get_string(exp, "title");
        const char* comp = get_string(exp, "company");
        const char* dur = get_string(exp, "duration");

        safe_strncat("\n");
        safe_strncat(title);
        if (comp && strlen(comp) > 0 && strcmp(comp, "N/A") != 0) {
            safe_strncat(" @ ");
            safe_strncat(comp);
        }
        if (dur && strlen(dur) > 0 && strcmp(dur, "N/A") != 0) {
            safe_strncat(" (");
            safe_strncat(dur);
            safe_strncat(")");
        }
        safe_strncat("\n");

        cJSON* desc_items = cJSON_GetObjectItem(exp, "description");
        if (desc_items && cJSON_IsArray(desc_items)) {
            cJSON* item = NULL;
            cJSON_ArrayForEach(item, desc_items) {
                if (item && item->valuestring) {
                    safe_strncat("  - ");
                    safe_strncat(item->valuestring);
                    size_t vlen = strlen(item->valuestring);
                    if (vlen > 0 && item->valuestring[vlen - 1] != '\n') {
                        safe_strncat("\n");
                    }
                }
            }
        }
    }
}

void format_skills(cJSON* skills_obj) {
    safe_strncat("\n--- Technical Skills ---\n");
    if (!skills_obj) return;
    const char* categories[] = {"languages", "frameworks_libraries", "tools_platforms", "concepts", NULL};
    const char* titles[] = {"Languages", "Frameworks & Libraries", "Tools & Platforms", "Concepts"};
    for (int i = 0; categories[i] != NULL; i++) {
        cJSON* items = cJSON_GetObjectItem(skills_obj, categories[i]);
        if (!items || !cJSON_IsArray(items)) continue;
        char header[128];
        snprintf(header, sizeof(header), "\n[%s]\n", titles[i]);
        safe_strncat(header);

        cJSON* item = NULL;
        cJSON_ArrayForEach(item, items) {
            if (item && item->valuestring) {
                safe_strncat(item->valuestring);
                size_t vlen = strlen(item->valuestring);
                if (vlen > 0 && item->valuestring[vlen - 1] != '\n') {
                    safe_strncat("\n");
                }
            }
        }
    }
    safe_strncat("\n");
}

void format_education(cJSON* edu_obj) {
    safe_strncat("\n--- Education ---\n\n");
    char buffer[512];
    snprintf(buffer, sizeof(buffer), "%s\n%s\nExpected Graduation / Conferred: %s\n",
             get_string(edu_obj, "degree"),
             get_string(edu_obj, "institution"),
             get_string(edu_obj, "graduation_date"));
    safe_strncat(buffer);
}

void format_awards(cJSON* awards_array) {
    safe_strncat("\n--- Honors and Awards ---\n\n");
    if (!awards_array || !cJSON_IsArray(awards_array)) {
        safe_strncat("No awards listed.\n");
        return;
    }
    cJSON* award_item = NULL;
    cJSON_ArrayForEach(award_item, awards_array) {
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
    snprintf(buffer, sizeof(buffer), "Email:    %s\nLinkedIn: %s\nGitHub:   %s\n",
             get_string(contact_obj, "email"),
             get_string(contact_obj, "linkedin"),
             get_string(contact_obj, "github_profile"));
    safe_strncat(buffer);
}

void format_ls() {
    safe_strncat("\nAvailable sections:\n");
    safe_strncat("  about         Personal background and bio\n");
    safe_strncat("  projects      Featured software projects\n");
    safe_strncat("  skills        Technical skills and tools\n");
    safe_strncat("  experience    Professional work history\n");
    safe_strncat("  education     Academic background\n");
    safe_strncat("  awards        Honors and awards\n");
    safe_strncat("  contact       Email, LinkedIn, and GitHub\n\n");
    safe_strncat("Usage: cat <section>  or simply type the section name.\n");
}

void format_whoami() {
    safe_strncat("\nMatthew Nader (user@portfolio)\n");
    safe_strncat("Software Engineer & Systems Developer\n");
}

void format_help() {
    safe_strncat("\n--- Portfolio Terminal Help ---\n");
    safe_strncat("Commands:\n");
    safe_strncat("  cat <section>    Display content of a section\n");
    safe_strncat("  ls, dir          List all available sections\n");
    safe_strncat("  about            Shortcut to view About Me\n");
    safe_strncat("  projects         Shortcut to view Projects\n");
    safe_strncat("  skills           Shortcut to view Skills\n");
    safe_strncat("  experience       Shortcut to view Experience\n");
    safe_strncat("  education        Shortcut to view Education\n");
    safe_strncat("  awards           Shortcut to view Awards\n");
    safe_strncat("  contact          Shortcut to view Contact Info\n");
    safe_strncat("  echo <text>      Echo text to terminal\n");
    safe_strncat("  whoami, id       Display current user identity\n");
    safe_strncat("  date             Display system date and time\n");
    safe_strncat("  pwd              Print working directory\n");
    safe_strncat("  clear, cls       Clear the terminal screen\n");
    safe_strncat("  help             Show this help message\n");
}

void handle_section_command(const char* section) {
    if (!portfolio_data) {
        safe_strncat("\nError: Portfolio data is not loaded.\n");
        return;
    }
    cJSON* data = cJSON_GetObjectItem(portfolio_data, section);
    if (!data) {
        char err_buf[256];
        snprintf(err_buf, sizeof(err_buf), "\nError: Section '%s' not found. Type 'ls' to see sections.\n", section);
        safe_strncat(err_buf);
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
        char err_buf[256];
        snprintf(err_buf, sizeof(err_buf), "\nError: Display logic for '%s' is not implemented.\n", section);
        safe_strncat(err_buf);
    }
}

void handle_echo_text(const char* text) {
    safe_strncat("\n");
    if (text) safe_strncat(text);
    safe_strncat("\n");
}

void handle_date() {
    time_t t = time(NULL);
    struct tm *tm_info = localtime(&t);
    char time_buf[128];
    strftime(time_buf, sizeof(time_buf), "\n%a %b %d %H:%M:%S UTC %Y\n", tm_info);
    safe_strncat(time_buf);
}

void handle_pwd() {
    safe_strncat("\n/home/user/portfolio\n");
}

EMSCRIPTEN_KEEPALIVE
const char* process_command(const char* command_str, const char* json_data_str) {
    output_buffer[0] = '\0';
    out_len = 0;
    if (portfolio_data) cJSON_Delete(portfolio_data);
    portfolio_data = cJSON_Parse(json_data_str);
    if (portfolio_data == NULL) {
        snprintf(output_buffer, OUTPUT_BUFFER_SIZE, "Error: Failed to parse internal portfolio data.");
        return output_buffer;
    }
    YY_BUFFER_STATE buffer = yy_scan_string(command_str);
    yyparse();
    yy_delete_buffer(buffer);
    cJSON_Delete(portfolio_data);
    portfolio_data = NULL;
    return output_buffer;
}
%}

%union { char *str; }
%token <str> T_IDENTIFIER T_STRING
%token T_CAT T_ECHO T_HELP T_CLEAR T_LS T_WHOAMI T_DATE T_PWD T_HISTORY T_EXIT T_EOL
%token T_SEC_ABOUT T_SEC_PROJECTS T_SEC_SKILLS T_SEC_EXPERIENCE T_SEC_EDUCATION T_SEC_AWARDS T_SEC_CONTACT

%type <str> text_list text_arg

%%

input:
      /* empty */
    | line
    ;

line:
      command
    | command T_EOL
    | T_EOL
    ;

command:
      T_CAT T_IDENTIFIER        { handle_section_command($2); free($2); }
    | T_CAT T_SEC_ABOUT         { handle_section_command("about"); }
    | T_CAT T_SEC_PROJECTS      { handle_section_command("projects"); }
    | T_CAT T_SEC_SKILLS        { handle_section_command("skills"); }
    | T_CAT T_SEC_EXPERIENCE    { handle_section_command("experience"); }
    | T_CAT T_SEC_EDUCATION     { handle_section_command("education"); }
    | T_CAT T_SEC_AWARDS        { handle_section_command("awards"); }
    | T_CAT T_SEC_CONTACT       { handle_section_command("contact"); }
    | T_CAT                     { safe_strncat("\ncat: missing section argument.\nUsage: cat <section> (e.g. 'cat about', 'cat projects')\nType 'ls' for all sections.\n"); }
    | T_SEC_ABOUT               { handle_section_command("about"); }
    | T_SEC_PROJECTS            { handle_section_command("projects"); }
    | T_SEC_SKILLS              { handle_section_command("skills"); }
    | T_SEC_EXPERIENCE          { handle_section_command("experience"); }
    | T_SEC_EDUCATION           { handle_section_command("education"); }
    | T_SEC_AWARDS              { handle_section_command("awards"); }
    | T_SEC_CONTACT             { handle_section_command("contact"); }
    | T_ECHO text_list          { handle_echo_text($2); free($2); }
    | T_ECHO                    { handle_echo_text(""); }
    | T_LS                      { format_ls(); }
    | T_WHOAMI                  { format_whoami(); }
    | T_DATE                    { handle_date(); }
    | T_PWD                     { handle_pwd(); }
    | T_HISTORY                 { safe_strncat("\nUse Up/Down arrows on your keyboard to navigate command history.\n"); }
    | T_EXIT                    { safe_strncat("\nSession cannot be closed. Type 'help' for commands.\n"); }
    | T_HELP                    { format_help(); }
    | T_CLEAR                   { strncpy(output_buffer, "COMMAND_CLEAR", OUTPUT_BUFFER_SIZE); }
    ;

text_list:
      text_arg                  { $$ = $1; }
    | text_list text_arg        {
        size_t len1 = strlen($1);
        size_t len2 = strlen($2);
        char *combined = (char*)malloc(len1 + 1 + len2 + 1);
        if (combined) {
            strcpy(combined, $1);
            strcat(combined, " ");
            strcat(combined, $2);
            $$ = combined;
        } else {
            $$ = $1;
        }
        free($1);
        free($2);
    }
    ;

text_arg:
      T_IDENTIFIER              { $$ = $1; }
    | T_STRING                  { $$ = $1; }
    ;

%%

void yyerror(const char *s) {
    if (out_len == 0) {
        snprintf(output_buffer, OUTPUT_BUFFER_SIZE, "\nCommand not recognized. Type 'help' for usage or 'ls' for sections.\n");
        out_len = strlen(output_buffer);
    }
}
