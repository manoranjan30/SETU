# Docker Scout CVE List (2026-04-10)

Generated from the images that existed before dependency/Dockerfile updates in this change set.
Rebuild the images and rerun Docker Scout to capture the post-fix CVE list.

## setu-backend:latest (manoranjan30/setu-backend:latest)

| ID | Severity | Package | Affected Range | Fixed Version | Location |
| --- | --- | --- | --- | --- | --- |
| CVE-2023-30533 | HIGH | pkg:npm/xlsx@0.18.5 | <0.19.3 | not fixed | /app/backend/node_modules/xlsx/package.json |
| CVE-2024-22363 | HIGH | pkg:npm/xlsx@0.18.5 | <0.20.2 | not fixed | /app/backend/node_modules/xlsx/package.json |
| CVE-2025-13465 | MEDIUM | pkg:npm/lodash@4.17.21 | >=4.0.0,<=4.17.22 | 4.17.23 | /app/backend/node_modules/lodash/package.json |
| CVE-2025-60876 | MEDIUM | pkg:apk/alpine/busybox@1.37.0-r30?os_name=alpine&os_version=3.23 | <=1.37.0-r30 | not fixed | /lib/apk/db/installed |
| CVE-2025-68157 | LOW | pkg:npm/webpack@5.103.0 | >=5.49.0,<5.104.0 | 5.104.0 | /app/backend/node_modules/@nestjs/cli/node_modules/webpack/package.json |
| CVE-2025-68458 | LOW | pkg:npm/webpack@5.103.0 | >=5.49.0,<=5.104.0 | 5.104.1 | /app/backend/node_modules/@nestjs/cli/node_modules/webpack/package.json |
| CVE-2025-69873 | MEDIUM | pkg:npm/ajv@6.12.6 | <6.14.0 | 8.18.0 | /app/backend/node_modules/ajv/package.json |
| CVE-2025-69873 | MEDIUM | pkg:npm/ajv@8.17.1 | >=7.0.0-alpha.0,<8.18.0 | 8.18.0 | /app/backend/node_modules/@angular-devkit/core/node_modules/ajv/package.json |
| CVE-2026-22184 | MEDIUM | pkg:apk/alpine/zlib@1.3.1-r2?os_name=alpine&os_version=3.23 | <1.3.2-r0 | 1.3.2-r0 | /lib/apk/db/installed |
| CVE-2026-2359 | HIGH | pkg:npm/multer@2.0.2 | <2.1.0 | 2.1.0 | /app/backend/node_modules/multer/package.json |
| CVE-2026-2391 | LOW | pkg:npm/qs@6.14.1 | >=6.7.0,<=6.14.1 | 6.14.2 | /app/backend/node_modules/qs/package.json |
| CVE-2026-24001 | LOW | pkg:npm/diff@4.0.2 | >=4.0.0,<4.0.4 | 4.0.4 | /app/backend/node_modules/diff/package.json |
| CVE-2026-25547 | HIGH | pkg:npm/%40isaacs/brace-expansion@5.0.0 | <=5.0.0 | 5.0.1 | /app/backend/node_modules/@isaacs/brace-expansion/package.json |
| CVE-2026-25639 | HIGH | pkg:npm/axios@1.13.4 | >=1.0.0,<=1.13.4 | 1.13.5 | /app/backend/node_modules/axios/package.json |
| CVE-2026-26996 | HIGH | pkg:npm/minimatch@10.1.1 | >=10.0.0,<10.2.1 | 10.2.1 | /app/backend/node_modules/glob/node_modules/minimatch/package.json |
| CVE-2026-26996 | HIGH | pkg:npm/minimatch@3.1.2 | <3.1.3 | 10.2.1 | /app/backend/node_modules/minimatch/package.json |
| CVE-2026-26996 | HIGH | pkg:npm/minimatch@9.0.5 | >=9.0.0,<9.0.6 | 10.2.1 | /app/backend/node_modules/@jest/reporters/node_modules/minimatch/package.json |
| CVE-2026-27171 | LOW | pkg:apk/alpine/zlib@1.3.1-r2?os_name=alpine&os_version=3.23 | <1.3.2-r0 | 1.3.2-r0 | /lib/apk/db/installed |
| CVE-2026-27903 | HIGH | pkg:npm/minimatch@10.1.1 | >=10.0.0,<10.2.3 | 10.2.3 | /app/backend/node_modules/glob/node_modules/minimatch/package.json |
| CVE-2026-27903 | HIGH | pkg:npm/minimatch@3.1.2 | <3.1.3 | 3.1.3 | /app/backend/node_modules/minimatch/package.json |
| CVE-2026-27903 | HIGH | pkg:npm/minimatch@9.0.5 | >=9.0.0,<9.0.7 | 9.0.7 | /app/backend/node_modules/@jest/reporters/node_modules/minimatch/package.json |
| CVE-2026-27904 | HIGH | pkg:npm/minimatch@10.1.1 | >=10.0.0,<10.2.3 | 10.2.3 | /app/backend/node_modules/glob/node_modules/minimatch/package.json |
| CVE-2026-27904 | HIGH | pkg:npm/minimatch@3.1.2 | <3.1.4 | 3.1.4 | /app/backend/node_modules/minimatch/package.json |
| CVE-2026-27904 | HIGH | pkg:npm/minimatch@9.0.5 | >=9.0.0,<9.0.7 | 9.0.7 | /app/backend/node_modules/@jest/reporters/node_modules/minimatch/package.json |
| CVE-2026-2950 | MEDIUM | pkg:npm/lodash@4.17.21 | <=4.17.23 | 4.18.0 | /app/backend/node_modules/lodash/package.json |
| CVE-2026-31808 | MEDIUM | pkg:npm/file-type@21.2.0 | >=13.0.0,<21.3.1 | 21.3.1 | /app/backend/node_modules/file-type/package.json |
| CVE-2026-32141 | HIGH | pkg:npm/flatted@3.3.3 | <3.4.0 | 3.4.0 | /app/backend/node_modules/flatted/package.json |
| CVE-2026-32630 | MEDIUM | pkg:npm/file-type@21.2.0 | >=20.0.0,<=21.3.1 | 21.3.2 | /app/backend/node_modules/file-type/package.json |
| CVE-2026-33036 | HIGH | pkg:npm/fast-xml-parser@5.4.1 | >=5.0.0,<5.5.6 | 5.5.6 | /app/backend/node_modules/fast-xml-parser/package.json |
| CVE-2026-3304 | HIGH | pkg:npm/multer@2.0.2 | <2.1.0 | 2.1.0 | /app/backend/node_modules/multer/package.json |
| CVE-2026-33228 | HIGH | pkg:npm/flatted@3.3.3 | <=3.4.1 | 3.4.2 | /app/backend/node_modules/flatted/package.json |
| CVE-2026-33349 | MEDIUM | pkg:npm/fast-xml-parser@5.4.1 | >=5.0.0,<5.5.7 | 5.5.7 | /app/backend/node_modules/fast-xml-parser/package.json |
| CVE-2026-33671 | HIGH | pkg:npm/picomatch@2.3.1 | <2.3.2 | 2.3.2 | /app/backend/node_modules/anymatch/node_modules/picomatch/package.json |
| CVE-2026-33671 | HIGH | pkg:npm/picomatch@4.0.2 | >=4.0.0,<4.0.4 | 4.0.4 | /app/backend/node_modules/picomatch/package.json |
| CVE-2026-33671 | HIGH | pkg:npm/picomatch@4.0.3 | >=4.0.0,<4.0.4 | 4.0.4 | /app/backend/node_modules/tinyglobby/node_modules/picomatch/package.json |
| CVE-2026-33672 | MEDIUM | pkg:npm/picomatch@2.3.1 | <2.3.2 | 2.3.2 | /app/backend/node_modules/anymatch/node_modules/picomatch/package.json |
| CVE-2026-33672 | MEDIUM | pkg:npm/picomatch@4.0.2 | >=4.0.0,<4.0.4 | 4.0.4 | /app/backend/node_modules/picomatch/package.json |
| CVE-2026-33672 | MEDIUM | pkg:npm/picomatch@4.0.3 | >=4.0.0,<4.0.4 | 4.0.4 | /app/backend/node_modules/tinyglobby/node_modules/picomatch/package.json |
| CVE-2026-33750 | MEDIUM | pkg:npm/brace-expansion@1.1.12 | <1.1.13 | 5.0.5 | /app/backend/node_modules/brace-expansion/package.json |
| CVE-2026-33750 | MEDIUM | pkg:npm/brace-expansion@2.0.2 | >=2.0.0,<2.0.3 | 5.0.5 | /app/backend/node_modules/@jest/reporters/node_modules/brace-expansion/package.json |
| CVE-2026-33891 | HIGH | pkg:npm/node-forge@1.3.3 | <1.4.0 | 1.4.0 | /app/backend/node_modules/node-forge/package.json |
| CVE-2026-33894 | HIGH | pkg:npm/node-forge@1.3.3 | <1.4.0 | 1.4.0 | /app/backend/node_modules/node-forge/package.json |
| CVE-2026-33895 | HIGH | pkg:npm/node-forge@1.3.3 | <1.4.0 | 1.4.0 | /app/backend/node_modules/node-forge/package.json |
| CVE-2026-33896 | HIGH | pkg:npm/node-forge@1.3.3 | <=1.3.3 | 1.4.0 | /app/backend/node_modules/node-forge/package.json |
| CVE-2026-33916 | MEDIUM | pkg:npm/handlebars@4.7.8 | >=4.0.0,<4.7.9 | 4.7.9 | /app/backend/node_modules/handlebars/package.json |
| CVE-2026-33937 | CRITICAL | pkg:npm/handlebars@4.7.8 | >=4.0.0,<=4.7.8 | 4.7.9 | /app/backend/node_modules/handlebars/package.json |
| CVE-2026-33938 | HIGH | pkg:npm/handlebars@4.7.8 | >=4.0.0,<=4.7.8 | 4.7.9 | /app/backend/node_modules/handlebars/package.json |
| CVE-2026-33939 | HIGH | pkg:npm/handlebars@4.7.8 | >=4.0.0,<=4.7.8 | 4.7.9 | /app/backend/node_modules/handlebars/package.json |
| CVE-2026-33940 | HIGH | pkg:npm/handlebars@4.7.8 | >=4.0.0,<=4.7.8 | 4.7.9 | /app/backend/node_modules/handlebars/package.json |
| CVE-2026-33941 | HIGH | pkg:npm/handlebars@4.7.8 | >=4.0.0,<=4.7.8 | 4.7.9 | /app/backend/node_modules/handlebars/package.json |
| CVE-2026-34043 | MEDIUM | pkg:npm/serialize-javascript@6.0.2 | <7.0.5 | 7.0.5 | /app/backend/node_modules/serialize-javascript/package.json |
| CVE-2026-3449 | LOW | pkg:npm/%40tootallnate/once@2.0.0 | <3.0.1 | 3.0.1 | /app/backend/node_modules/@tootallnate/once/package.json |
| CVE-2026-3520 | HIGH | pkg:npm/multer@2.0.2 | <2.1.1 | 2.1.1 | /app/backend/node_modules/multer/package.json |
| CVE-2026-35515 | MEDIUM | pkg:npm/%40nestjs/core@11.1.11 | <=11.1.17 | 11.1.18 | /app/backend/node_modules/@nestjs/core/package.json |
| CVE-2026-4800 | HIGH | pkg:npm/lodash@4.17.21 | >=4.0.0,<=4.17.23 | 4.18.0 | /app/backend/node_modules/lodash/package.json |
| CVE-2026-4923 | MEDIUM | pkg:npm/path-to-regexp@8.3.0 | >=8.0.0,<8.4.0 | 8.4.0 | /app/backend/node_modules/path-to-regexp/package.json |
| CVE-2026-4926 | HIGH | pkg:npm/path-to-regexp@8.3.0 | >=8.0.0,<8.4.0 | 8.4.0 | /app/backend/node_modules/path-to-regexp/package.json |
| GHSA-442j-39wm-28r2 | LOW | pkg:npm/handlebars@4.7.8 | >=4.0.0,<=4.7.8 | 4.7.9 | /app/backend/node_modules/handlebars/package.json |
| GHSA-5c6j-r48x-rmvq | HIGH | pkg:npm/serialize-javascript@6.0.2 | <=7.0.2 | 7.0.3 | /app/backend/node_modules/serialize-javascript/package.json |
| GHSA-7rx3-28cr-v5wh | MEDIUM | pkg:npm/handlebars@4.7.8 | >=4.6.0,<=4.7.8 | 4.7.9 | /app/backend/node_modules/handlebars/package.json |

## setu-frontend:latest (manoranjan30/setu-frontend:latest)

| ID | Severity | Package | Affected Range | Fixed Version | Location |
| --- | --- | --- | --- | --- | --- |
| CVE-2023-30533 | HIGH | pkg:npm/xlsx@0.18.5 | <0.19.3 | not fixed | /app/frontend/node_modules/xlsx/package.json |
| CVE-2024-22363 | HIGH | pkg:npm/xlsx@0.18.5 | <0.20.2 | not fixed | /app/frontend/node_modules/xlsx/package.json |
| CVE-2025-60876 | MEDIUM | pkg:apk/alpine/busybox@1.37.0-r30?os_name=alpine&os_version=3.23 | <=1.37.0-r30 | not fixed | /lib/apk/db/installed |
| CVE-2025-69873 | MEDIUM | pkg:npm/ajv@6.12.6 | <6.14.0 | 8.18.0 | /app/frontend/node_modules/ajv/package.json |
| CVE-2026-22184 | MEDIUM | pkg:apk/alpine/zlib@1.3.1-r2?os_name=alpine&os_version=3.23 | <1.3.2-r0 | 1.3.2-r0 | /lib/apk/db/installed |
| CVE-2026-25639 | HIGH | pkg:npm/axios@1.13.2 | >=1.0.0,<=1.13.4 | 1.13.5 | /app/frontend/node_modules/axios/package.json |
| CVE-2026-26996 | HIGH | pkg:npm/minimatch@3.1.2 | <3.1.3 | 10.2.1 | /app/frontend/node_modules/minimatch/package.json |
| CVE-2026-26996 | HIGH | pkg:npm/minimatch@9.0.5 | >=9.0.0,<9.0.6 | 10.2.1 | /app/frontend/node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch/package.json |
| CVE-2026-27171 | LOW | pkg:apk/alpine/zlib@1.3.1-r2?os_name=alpine&os_version=3.23 | <1.3.2-r0 | 1.3.2-r0 | /lib/apk/db/installed |
| CVE-2026-27606 | HIGH | pkg:npm/rollup@4.55.1 | >=4.0.0,<4.59.0 | 4.59.0 | /app/frontend/node_modules/rollup/package.json |
| CVE-2026-27903 | HIGH | pkg:npm/minimatch@3.1.2 | <3.1.3 | 3.1.3 | /app/frontend/node_modules/minimatch/package.json |
| CVE-2026-27903 | HIGH | pkg:npm/minimatch@9.0.5 | >=9.0.0,<9.0.7 | 9.0.7 | /app/frontend/node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch/package.json |
| CVE-2026-27904 | HIGH | pkg:npm/minimatch@3.1.2 | <3.1.4 | 3.1.4 | /app/frontend/node_modules/minimatch/package.json |
| CVE-2026-27904 | HIGH | pkg:npm/minimatch@9.0.5 | >=9.0.0,<9.0.7 | 9.0.7 | /app/frontend/node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch/package.json |
| CVE-2026-32141 | HIGH | pkg:npm/flatted@3.3.3 | <3.4.0 | 3.4.0 | /app/frontend/node_modules/flatted/package.json |
| CVE-2026-33228 | HIGH | pkg:npm/flatted@3.3.3 | <=3.4.1 | 3.4.2 | /app/frontend/node_modules/flatted/package.json |
| CVE-2026-33671 | HIGH | pkg:npm/picomatch@4.0.3 | >=4.0.0,<4.0.4 | 4.0.4 | /app/frontend/node_modules/picomatch/package.json |
| CVE-2026-33672 | MEDIUM | pkg:npm/picomatch@4.0.3 | >=4.0.0,<4.0.4 | 4.0.4 | /app/frontend/node_modules/picomatch/package.json |
| CVE-2026-33750 | MEDIUM | pkg:npm/brace-expansion@1.1.12 | <1.1.13 | 5.0.5 | /app/frontend/node_modules/brace-expansion/package.json |
| CVE-2026-33750 | MEDIUM | pkg:npm/brace-expansion@2.0.2 | >=2.0.0,<2.0.3 | 5.0.5 | /app/frontend/node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion/package.json |
| CVE-2026-39363 | HIGH | pkg:npm/vite@7.3.1 | >=7.0.0,<=7.3.1 | 7.3.2 | /app/frontend/node_modules/vite/package.json |
| CVE-2026-39364 | HIGH | pkg:npm/vite@7.3.1 | >=7.1.0,<=7.3.1 | 7.3.2 | /app/frontend/node_modules/vite/package.json |
| CVE-2026-39365 | MEDIUM | pkg:npm/vite@7.3.1 | >=7.0.0,<=7.3.1 | 7.3.2 | /app/frontend/node_modules/vite/package.json |

## setu-pdf-tool:latest (local)

| ID | Severity | Package | Affected Range | Fixed Version | Location |
| --- | --- | --- | --- | --- | --- |
| CVE-2005-2541 | LOW | pkg:deb/debian/tar@1.35%2Bdfsg-3.1?os_distro=trixie&os_name=debian&os_version=13 | <=1.35+dfsg-3.1 | not fixed | /usr/share/doc/tar/copyright |
| CVE-2007-5686 | LOW | pkg:deb/debian/shadow@1%3A4.17.4-2?os_distro=trixie&os_name=debian&os_version=13 | <=1:4.17.4-2 | not fixed | /usr/share/doc/login.defs/copyright |
| CVE-2010-0928 | LOW | pkg:deb/debian/openssl@3.5.5-1~deb13u2?os_distro=trixie&os_name=debian&os_version=13 | >=3.2.1-3 | not fixed | /usr/share/doc/libssl-dev/copyright |
| CVE-2010-4651 | LOW | pkg:deb/debian/patch@2.8-2?os_distro=trixie&os_name=debian&os_version=13 | <=2.8-2 | not fixed | /usr/share/doc/patch/copyright |
| CVE-2010-4756 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2011-3374 | LOW | pkg:deb/debian/apt@3.0.3?os_distro=trixie&os_name=debian&os_version=13 | <=3.0.3 | not fixed | /usr/share/doc/apt/copyright |
| CVE-2011-4116 | LOW | pkg:deb/debian/perl@5.40.1-6?os_distro=trixie&os_name=debian&os_version=13 | <=5.40.1-6 | not fixed | /usr/share/doc/libperl5.40/copyright |
| CVE-2013-4392 | LOW | pkg:deb/debian/systemd@257.8-1~deb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=257.9-1~deb13u1 | not fixed | /usr/share/doc/libsystemd0/copyright |
| CVE-2017-13716 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2017-18018 | LOW | pkg:deb/debian/coreutils@9.7-3?os_distro=trixie&os_name=debian&os_version=13 | <=9.7-3 | not fixed | /usr/share/doc/coreutils/copyright |
| CVE-2018-20673 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2018-20712 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2018-20796 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2018-6951 | LOW | pkg:deb/debian/patch@2.8-2?os_distro=trixie&os_name=debian&os_version=13 | <=2.8-2 | not fixed | /usr/share/doc/patch/copyright |
| CVE-2018-6952 | LOW | pkg:deb/debian/patch@2.8-2?os_distro=trixie&os_name=debian&os_version=13 | <=2.8-2 | not fixed | /usr/share/doc/patch/copyright |
| CVE-2018-9996 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2019-1010022 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2019-1010023 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2019-1010024 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2019-1010025 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2019-9192 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2020-36325 | LOW | pkg:deb/debian/jansson@2.14-2?os_distro=trixie&os_name=debian&os_version=13 | <=2.14-2 | not fixed | /usr/share/doc/libjansson4/copyright |
| CVE-2021-32256 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2021-45261 | LOW | pkg:deb/debian/patch@2.8-2?os_distro=trixie&os_name=debian&os_version=13 | <=2.8-2 | not fixed | /usr/share/doc/patch/copyright |
| CVE-2021-45346 | LOW | pkg:deb/debian/sqlite3@3.46.1-7?os_distro=trixie&os_name=debian&os_version=13 | <=3.46.1-7+deb13u1 | not fixed | /usr/share/doc/libsqlite3-0/copyright |
| CVE-2022-0563 | LOW | pkg:deb/debian/util-linux@2.41-5?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-5 | not fixed | /usr/share/doc/bsdutils/copyright |
| CVE-2023-31437 | LOW | pkg:deb/debian/systemd@257.8-1~deb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=257.9-1~deb13u1 | not fixed | /usr/share/doc/libsystemd0/copyright |
| CVE-2023-31438 | LOW | pkg:deb/debian/systemd@257.8-1~deb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=257.9-1~deb13u1 | not fixed | /usr/share/doc/libsystemd0/copyright |
| CVE-2023-31439 | LOW | pkg:deb/debian/systemd@257.8-1~deb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=257.9-1~deb13u1 | not fixed | /usr/share/doc/libsystemd0/copyright |
| CVE-2023-5752 | MEDIUM | pkg:pypi/pip@23.0.1 | <23.3 | 23.3 | /usr/local/lib/python3.9/site-packages/pip-23.0.1.dist-info/METADATA |
| CVE-2025-11081 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-11082 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-11083 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-11412 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-11413 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-11414 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-1147 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-1148 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-1149 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-11494 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-11495 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-1150 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-1151 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-1152 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-1153 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-1176 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-1178 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-1180 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-1181 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-1182 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-11839 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-11840 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-14104 | LOW | pkg:deb/debian/util-linux@2.41-5?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-5 | not fixed | /usr/share/doc/bsdutils/copyright |
| CVE-2025-3198 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-45582 | MEDIUM | pkg:deb/debian/tar@1.35%2Bdfsg-3.1?os_distro=trixie&os_name=debian&os_version=13 | >=1.35+dfsg-3.1 | not fixed | /usr/share/doc/tar/copyright |
| CVE-2025-5244 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-5245 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-5278 | LOW | pkg:deb/debian/coreutils@9.7-3?os_distro=trixie&os_name=debian&os_version=13 | <=9.7-3 | not fixed | /usr/share/doc/coreutils/copyright |
| CVE-2025-66861 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-66862 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-66863 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-66864 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-66865 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-66866 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-69644 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-69645 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-69646 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-69647 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-69648 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-69649 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-69650 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-69651 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-69652 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-70873 | LOW | pkg:deb/debian/sqlite3@3.46.1-7?os_distro=trixie&os_name=debian&os_version=13 | <=3.46.1-7+deb13u1 | not fixed | /usr/share/doc/libsqlite3-0/copyright |
| CVE-2025-7545 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-7546 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-7709 | LOW | pkg:deb/debian/sqlite3@3.46.1-7?os_distro=trixie&os_name=debian&os_version=13 | <3.46.1-7+deb13u1 | 3.46.1-7+deb13u1 | /usr/share/doc/libsqlite3-0/copyright |
| CVE-2025-8225 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2025-8869 | MEDIUM | pkg:pypi/pip@23.0.1 | <=25.2 | 25.3 | /usr/local/lib/python3.9/site-packages/pip-23.0.1.dist-info/METADATA |
| CVE-2026-1703 | LOW | pkg:pypi/pip@23.0.1 | <26.0 | 26.0 | /usr/local/lib/python3.9/site-packages/pip-23.0.1.dist-info/METADATA |
| CVE-2026-24049 | HIGH | pkg:pypi/wheel@0.45.1 | >=0.40.0,<=0.46.1 | 0.46.2 | /usr/local/lib/python3.9/site-packages/setuptools/_vendor/wheel-0.45.1.dist-info/METADATA |
| CVE-2026-24486 | HIGH | pkg:pypi/python-multipart@0.0.20 | <0.0.22 | 0.0.22 | /usr/local/lib/python3.9/site-packages/python_multipart-0.0.20.dist-info/METADATA |
| CVE-2026-25645 | MEDIUM | pkg:pypi/requests@2.32.5 | <2.33.0 | 2.33.0 | /usr/local/lib/python3.9/site-packages/requests-2.32.5.dist-info/METADATA |
| CVE-2026-25990 | HIGH | pkg:pypi/pillow@11.3.0 | >=10.3.0,<12.1.1 | 12.1.1 | /usr/local/lib/python3.9/site-packages/pillow-11.3.0.dist-info/METADATA |
| CVE-2026-27601 | HIGH | pkg:deb/debian/underscore@1.13.4~dfsg%2B~1.11.4-3?os_distro=trixie&os_name=debian&os_version=13 | <=1.13.4~dfsg+~1.11.4-3 | not fixed | /usr/share/doc/libjs-underscore/copyright |
| CVE-2026-3441 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2026-3442 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2026-3479 | LOW | pkg:deb/debian/python3.13@3.13.5-2?os_distro=trixie&os_name=debian&os_version=13 | <=3.13.5-2 | not fixed | /usr/share/doc/libpython3.13-minimal/copyright |
| CVE-2026-4647 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/share/doc/binutils-common/copyright |
| CVE-2026-5704 | MEDIUM | pkg:deb/debian/tar@1.35%2Bdfsg-3.1?os_distro=trixie&os_name=debian&os_version=13 | <=1.35+dfsg-3.1 | not fixed | /usr/share/doc/tar/copyright |
