#include <stdint.h>
#include <stddef.h>
typedef uint16_t UChar; typedef int UErrorCode; typedef double UDate;
typedef void UCalendar; typedef void UBreakIterator; typedef void UListFormatter;
#define FAIL(s) do{ if(s && *s<=0) *s=16; }while(0)
extern int32_t ucal_getDefaultTimeZone(UChar*, int32_t, UErrorCode*);
extern UBreakIterator* ubrk_safeClone(const UBreakIterator*, void*, int32_t*, UErrorCode*);
extern UListFormatter* ulistfmt_open(const char*, UErrorCode*);
extern UCalendar* ucal_clone(const UCalendar*, UErrorCode*);
extern void ucal_close(UCalendar*);
extern UDate ucal_getMillis(const UCalendar*, UErrorCode*);
extern void ucal_setMillis(UCalendar*, UDate, UErrorCode*);
extern int32_t ucal_get(const UCalendar*, int, UErrorCode*);
enum { UCAL_ZONE_OFFSET = 15, UCAL_DST_OFFSET = 16 };
int32_t ucal_getHostTimeZone(UChar* r, int32_t c, UErrorCode* s){ return ucal_getDefaultTimeZone(r, c, s); }
UBreakIterator* ubrk_clone(const UBreakIterator* b, UErrorCode* s){ return ubrk_safeClone(b, NULL, NULL, s); }
UListFormatter* ulistfmt_openForType(const char* l, int type, int width, UErrorCode* s){ return ulistfmt_open(l, s); }
void ucal_getTimeZoneOffsetFromLocal(const UCalendar* cal, int a, int b, int32_t* raw, int32_t* dst, UErrorCode* s){
  if (*s > 0) return;
  UDate local = ucal_getMillis(cal, s);
  UCalendar* c = ucal_clone(cal, s); if (*s > 0) return;
  int32_t r = 0, d = 0;
  ucal_setMillis(c, local, s);
  for (int i = 0; i < 3 && *s <= 0; i++){
    r = ucal_get(c, UCAL_ZONE_OFFSET, s); d = ucal_get(c, UCAL_DST_OFFSET, s);
    ucal_setMillis(c, local - (r + d), s);
  }
  r = ucal_get(c, UCAL_ZONE_OFFSET, s); d = ucal_get(c, UCAL_DST_OFFSET, s);
  ucal_close(c); *raw = r; *dst = d;
}
void* unumrf_openForSkeletonWithCollapseAndIdentityFallback(const UChar* k, int32_t l, int c, int f, const char* loc, void* pe, UErrorCode* s){ FAIL(s); return NULL; }
void unumrf_close(void* p){}
void* unumrf_openResult(UErrorCode* s){ FAIL(s); return NULL; }
void unumrf_closeResult(void* p){}
void unumrf_formatDoubleRange(const void* f, double a, double b, void* r, UErrorCode* s){ FAIL(s); }
void unumrf_formatDecimalRange(const void* f, const char* a, int32_t al, const char* b, int32_t bl, void* r, UErrorCode* s){ FAIL(s); }
const void* unumrf_resultAsValue(const void* r, UErrorCode* s){ FAIL(s); return NULL; }
void udtitvfmt_formatCalendarToResult(const void* f, void* a, void* b, void* r, UErrorCode* s){ FAIL(s); }
int32_t uplrules_selectForRange(const void* p, const void* r, UChar* k, int32_t c, UErrorCode* s){ FAIL(s); return 0; }
