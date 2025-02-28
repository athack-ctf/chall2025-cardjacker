#include <stdio.h>

#if defined(REAL_FLAG)
    #define FLAG_VALUE "ATHACKCTF{Spacele$$_$$urfing_On_Polluted_$hells}"
#else
    #define FLAG_VALUE "this_is_NOT_the_real_flag"
#endif

int main() {
    printf("%s\n", FLAG_VALUE);
    return 0;
}
