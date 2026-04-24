# Docker Scout CVE List (Post-Fix, 2026-04-10)

This report is generated after rebuilding images with updated dependencies and base image upgrades.

## setu-backend:latest (manoranjan30/setu-backend:latest) [npm]

| ID | Severity | Package | Affected Range | Fixed Version | Location |
| --- | --- | --- | --- | --- | --- |
| CVE-2023-30533 | HIGH | pkg:npm/xlsx@0.18.5 | <0.19.3 | not fixed | /usr/src/app/node_modules/xlsx/package.json |
| CVE-2024-22363 | HIGH | pkg:npm/xlsx@0.18.5 | <0.20.2 | not fixed | /usr/src/app/node_modules/xlsx/package.json |
| CVE-2025-13465 | MEDIUM | pkg:npm/lodash@4.17.21 | >=4.0.0,<=4.17.22 | 4.17.23 | /usr/src/app/node_modules/@nestjs/swagger/node_modules/lodash/package.json |
| CVE-2025-68157 | LOW | pkg:npm/webpack@5.103.0 | >=5.49.0,<5.104.0 | 5.104.0 | /usr/src/app/node_modules/@nestjs/cli/node_modules/webpack/package.json |
| CVE-2025-68458 | LOW | pkg:npm/webpack@5.103.0 | >=5.49.0,<=5.104.0 | 5.104.1 | /usr/src/app/node_modules/@nestjs/cli/node_modules/webpack/package.json |
| CVE-2026-2950 | MEDIUM | pkg:npm/lodash@4.17.21 | <=4.17.23 | 4.18.0 | /usr/src/app/node_modules/@nestjs/swagger/node_modules/lodash/package.json |
| CVE-2026-33671 | HIGH | pkg:npm/picomatch@4.0.3 | >=4.0.0,<4.0.4 | 4.0.4 | /usr/local/lib/node_modules/npm/node_modules/picomatch/package.json |
| CVE-2026-33672 | MEDIUM | pkg:npm/picomatch@4.0.3 | >=4.0.0,<4.0.4 | 4.0.4 | /usr/local/lib/node_modules/npm/node_modules/picomatch/package.json |
| CVE-2026-33750 | MEDIUM | pkg:npm/brace-expansion@2.0.2 | >=2.0.0,<2.0.3 | 5.0.5 | /usr/local/lib/node_modules/npm/node_modules/brace-expansion/package.json |
| CVE-2026-34043 | MEDIUM | pkg:npm/serialize-javascript@6.0.2 | <7.0.5 | 7.0.5 | /usr/src/app/node_modules/terser-webpack-plugin/node_modules/serialize-javascript/package.json |
| CVE-2026-3449 | LOW | pkg:npm/%40tootallnate/once@2.0.0 | <3.0.1 | 3.0.1 | /usr/src/app/node_modules/http-proxy-agent/node_modules/@tootallnate/once/package.json |
| CVE-2026-4800 | HIGH | pkg:npm/lodash@4.17.21 | >=4.0.0,<=4.17.23 | 4.18.0 | /usr/src/app/node_modules/@nestjs/swagger/node_modules/lodash/package.json |
| GHSA-5c6j-r48x-rmvq | HIGH | pkg:npm/serialize-javascript@6.0.2 | <=7.0.2 | 7.0.3 | /usr/src/app/node_modules/terser-webpack-plugin/node_modules/serialize-javascript/package.json |

## setu-backend:latest (manoranjan30/setu-backend:latest) [apk]

| ID | Severity | Package | Affected Range | Fixed Version | Location |
| --- | --- | --- | --- | --- | --- |
| CVE-2025-60876 | MEDIUM | pkg:apk/alpine/busybox@1.37.0-r30?os_name=alpine&os_version=3.23 | <=1.37.0-r30 | not fixed | /lib/apk/db/installed |

## setu-frontend:latest (manoranjan30/setu-frontend:latest) [npm]

| ID | Severity | Package | Affected Range | Fixed Version | Location |
| --- | --- | --- | --- | --- | --- |
| CVE-2023-30533 | HIGH | pkg:npm/xlsx@0.18.5 | <0.19.3 | not fixed | /app/node_modules/xlsx/package.json |
| CVE-2024-22363 | HIGH | pkg:npm/xlsx@0.18.5 | <0.20.2 | not fixed | /app/node_modules/xlsx/package.json |
| CVE-2026-33671 | HIGH | pkg:npm/picomatch@4.0.3 | >=4.0.0,<4.0.4 | 4.0.4 | /usr/local/lib/node_modules/npm/node_modules/picomatch/package.json |
| CVE-2026-33672 | MEDIUM | pkg:npm/picomatch@4.0.3 | >=4.0.0,<4.0.4 | 4.0.4 | /usr/local/lib/node_modules/npm/node_modules/picomatch/package.json |
| CVE-2026-33750 | MEDIUM | pkg:npm/brace-expansion@2.0.2 | >=2.0.0,<2.0.3 | 5.0.5 | /usr/local/lib/node_modules/npm/node_modules/brace-expansion/package.json |

## setu-frontend:latest (manoranjan30/setu-frontend:latest) [apk]

| ID | Severity | Package | Affected Range | Fixed Version | Location |
| --- | --- | --- | --- | --- | --- |
| CVE-2025-60876 | MEDIUM | pkg:apk/alpine/busybox@1.37.0-r30?os_name=alpine&os_version=3.23 | <=1.37.0-r30 | not fixed | /lib/apk/db/installed |

## setu-pdf-tool:latest (local) [pypi]

| ID | Severity | Package | Affected Range | Fixed Version | Location |
| --- | --- | --- | --- | --- | --- |
| CVE-2026-24049 | HIGH | pkg:pypi/wheel@0.45.1 | >=0.40.0,<=0.46.1 | 0.46.2 | /usr/local/lib/python3.11/site-packages/setuptools/_vendor/wheel-0.45.1.dist-info/METADATA |

## setu-pdf-tool:latest (local) [deb]

| ID | Severity | Package | Affected Range | Fixed Version | Location |
| --- | --- | --- | --- | --- | --- |
| CVE-2005-2541 | LOW | pkg:deb/debian/tar@1.35%2Bdfsg-3.1?os_distro=trixie&os_name=debian&os_version=13 | <=1.35+dfsg-3.1 | not fixed | /usr/share/doc/tar/copyright |
| CVE-2007-5686 | LOW | pkg:deb/debian/shadow@1%3A4.17.4-2?os_distro=trixie&os_name=debian&os_version=13 | <=1:4.17.4-2 | not fixed | /usr/bin/chage |
| CVE-2010-0928 | LOW | pkg:deb/debian/openssl@3.5.5-1~deb13u2?os_distro=trixie&os_name=debian&os_version=13 | >=3.2.1-3 | not fixed | /usr/share/doc/libssl-dev/copyright |
| CVE-2010-4651 | LOW | pkg:deb/debian/patch@2.8-2?os_distro=trixie&os_name=debian&os_version=13 | <=2.8-2 | not fixed | /usr/share/doc/patch/copyright |
| CVE-2010-4756 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2011-3374 | LOW | pkg:deb/debian/apt@3.0.3?os_distro=trixie&os_name=debian&os_version=13 | <=3.0.3 | not fixed | /usr/share/doc/apt/copyright |
| CVE-2011-4116 | LOW | pkg:deb/debian/perl@5.40.1-6?os_distro=trixie&os_name=debian&os_version=13 | <=5.40.1-6 | not fixed | /usr/share/doc/libperl5.40/copyright |
| CVE-2013-4392 | LOW | pkg:deb/debian/systemd@257.9-1~deb13u1?os_distro=trixie&os_name=debian&os_version=13 | <=257.9-1~deb13u1 | not fixed | /usr/lib/x86_64-linux-gnu/libsystemd.so.0.40.0 |
| CVE-2017-13716 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2017-18018 | LOW | pkg:deb/debian/coreutils@9.7-3?os_distro=trixie&os_name=debian&os_version=13 | <=9.7-3 | not fixed | /usr/share/doc/coreutils/copyright |
| CVE-2018-20673 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2018-20712 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2018-20796 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2018-6951 | LOW | pkg:deb/debian/patch@2.8-2?os_distro=trixie&os_name=debian&os_version=13 | <=2.8-2 | not fixed | /usr/share/doc/patch/copyright |
| CVE-2018-6952 | LOW | pkg:deb/debian/patch@2.8-2?os_distro=trixie&os_name=debian&os_version=13 | <=2.8-2 | not fixed | /usr/share/doc/patch/copyright |
| CVE-2018-9996 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2019-1010022 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2019-1010023 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2019-1010024 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2019-1010025 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2019-9192 | LOW | pkg:deb/debian/glibc@2.41-12%2Bdeb13u2?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-12+deb13u2 | not fixed | /usr/share/doc/libc-bin/copyright |
| CVE-2020-36325 | LOW | pkg:deb/debian/jansson@2.14-2?os_distro=trixie&os_name=debian&os_version=13 | <=2.14-2 | not fixed | /usr/share/doc/libjansson4/copyright |
| CVE-2021-32256 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2021-45261 | LOW | pkg:deb/debian/patch@2.8-2?os_distro=trixie&os_name=debian&os_version=13 | <=2.8-2 | not fixed | /usr/share/doc/patch/copyright |
| CVE-2021-45346 | LOW | pkg:deb/debian/sqlite3@3.46.1-7%2Bdeb13u1?os_distro=trixie&os_name=debian&os_version=13 | <=3.46.1-7+deb13u1 | not fixed | /usr/share/doc/libsqlite3-0/copyright |
| CVE-2022-0563 | LOW | pkg:deb/debian/util-linux@2.41-5?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-5 | not fixed | /usr/bin/choom |
| CVE-2023-31437 | LOW | pkg:deb/debian/systemd@257.9-1~deb13u1?os_distro=trixie&os_name=debian&os_version=13 | <=257.9-1~deb13u1 | not fixed | /usr/lib/x86_64-linux-gnu/libsystemd.so.0.40.0 |
| CVE-2023-31438 | LOW | pkg:deb/debian/systemd@257.9-1~deb13u1?os_distro=trixie&os_name=debian&os_version=13 | <=257.9-1~deb13u1 | not fixed | /usr/lib/x86_64-linux-gnu/libsystemd.so.0.40.0 |
| CVE-2023-31439 | LOW | pkg:deb/debian/systemd@257.9-1~deb13u1?os_distro=trixie&os_name=debian&os_version=13 | <=257.9-1~deb13u1 | not fixed | /usr/lib/x86_64-linux-gnu/libsystemd.so.0.40.0 |
| CVE-2025-11081 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-11082 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-11083 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-11412 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-11413 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-11414 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-1147 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-1148 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-1149 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-11494 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-11495 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-1150 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-1151 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-1152 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-1153 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-1176 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-1178 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-1180 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-1181 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-1182 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-11839 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-11840 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-14104 | LOW | pkg:deb/debian/util-linux@2.41-5?os_distro=trixie&os_name=debian&os_version=13 | <=2.41-5 | not fixed | /usr/bin/choom |
| CVE-2025-3198 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-45582 | MEDIUM | pkg:deb/debian/tar@1.35%2Bdfsg-3.1?os_distro=trixie&os_name=debian&os_version=13 | >=1.35+dfsg-3.1 | not fixed | /usr/share/doc/tar/copyright |
| CVE-2025-5244 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-5245 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-5278 | LOW | pkg:deb/debian/coreutils@9.7-3?os_distro=trixie&os_name=debian&os_version=13 | <=9.7-3 | not fixed | /usr/share/doc/coreutils/copyright |
| CVE-2025-66861 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-66862 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-66863 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-66864 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-66865 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-66866 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-69644 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-69645 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-69646 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-69647 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-69648 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-69649 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-69650 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-69651 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-69652 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-70873 | LOW | pkg:deb/debian/sqlite3@3.46.1-7%2Bdeb13u1?os_distro=trixie&os_name=debian&os_version=13 | <=3.46.1-7+deb13u1 | not fixed | /usr/share/doc/libsqlite3-0/copyright |
| CVE-2025-7545 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-7546 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2025-8225 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2026-27601 | HIGH | pkg:deb/debian/underscore@1.13.4~dfsg%2B~1.11.4-3?os_distro=trixie&os_name=debian&os_version=13 | <=1.13.4~dfsg+~1.11.4-3 | not fixed | /usr/share/doc/libjs-underscore/copyright |
| CVE-2026-3441 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2026-3442 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2026-3479 | LOW | pkg:deb/debian/python3.13@3.13.5-2?os_distro=trixie&os_name=debian&os_version=13 | <=3.13.5-2 | not fixed | /usr/share/doc/libpython3.13-minimal/copyright |
| CVE-2026-4647 | LOW | pkg:deb/debian/binutils@2.44-3?os_distro=trixie&os_name=debian&os_version=13 | <=2.44-3 | not fixed | /usr/bin/gprofng |
| CVE-2026-5704 | MEDIUM | pkg:deb/debian/tar@1.35%2Bdfsg-3.1?os_distro=trixie&os_name=debian&os_version=13 | <=1.35+dfsg-3.1 | not fixed | /usr/share/doc/tar/copyright |
