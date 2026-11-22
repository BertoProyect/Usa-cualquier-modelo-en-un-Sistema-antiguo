#include <stdint.h>
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <unistd.h>
#include <sys/uio.h>
#include <spawn.h>
extern int __ulock_wait(uint32_t op, void *addr, uint64_t value, uint32_t timeout_us);
int __ulock_wait2(uint32_t op, void *addr, uint64_t value, uint64_t timeout_ns, uint64_t value2){
  uint64_t us = timeout_ns ? (timeout_ns + 999) / 1000 : 0;
  if (timeout_ns && us == 0) us = 1;
  if (us > UINT32_MAX) us = UINT32_MAX;
  return __ulock_wait(op, addr, value, (uint32_t)us);
}
int posix_spawn_file_actions_addfchdir(posix_spawn_file_actions_t *fa, int fd){
  char p[PATH_MAX];
  if (fcntl(fd, F_GETPATH, p) == -1) return errno;
  return posix_spawn_file_actions_addchdir_np(fa, p);
}
static ssize_t do_pv(int w, int fd, const struct iovec *iov, int n, off_t off){
  ssize_t t = 0;
  for (int i = 0; i < n; i++){
    size_t len = iov[i].iov_len, done = 0;
    while (done < len){
      ssize_t r = w ? pwrite(fd, (char*)iov[i].iov_base + done, len - done, off + t)
                    : pread(fd, (char*)iov[i].iov_base + done, len - done, off + t);
      if (r < 0) return t ? t : -1;
      if (r == 0) return t;
      done += r; t += r;
    }
  }
  return t;
}
ssize_t cc_preadv(int fd, const struct iovec *v, int n, off_t o) __asm__("_preadv$NOCANCEL");
ssize_t cc_preadv(int fd, const struct iovec *v, int n, off_t o){ return do_pv(0, fd, v, n, o); }
ssize_t cc_pwritev(int fd, const struct iovec *v, int n, off_t o) __asm__("_pwritev$NOCANCEL");
ssize_t cc_pwritev(int fd, const struct iovec *v, int n, off_t o){ return do_pv(1, fd, v, n, o); }
ssize_t cc_preadv2(int fd, const struct iovec *v, int n, off_t o) __asm__("_preadv");
ssize_t cc_preadv2(int fd, const struct iovec *v, int n, off_t o){ return do_pv(0, fd, v, n, o); }
ssize_t cc_pwritev2(int fd, const struct iovec *v, int n, off_t o) __asm__("_pwritev");
ssize_t cc_pwritev2(int fd, const struct iovec *v, int n, off_t o){ return do_pv(1, fd, v, n, o); }
