/* ******************************************************************************* */
/*                                                                                 */
/*   main_bonus_test.c                                                             */
/*                                                                                 */
/*   Compile:																	   */
/*     make bonus																   */
/*     cc -Wall -Wextra -Werror main_bonus_test.c libftprintf.a -o test_printf     */
/*     ./test_printf															   */	
/*																				   */	
/*   This file is only a local tester. Do not submit it if your evaluator          */
/*   requires only the project files.                                              */
/*                                                                                 */
/* ******************************************************************************* */

#include "ft_printf.h"
#include <limits.h>
#include <stdio.h>

#if defined(__GNUC__) || defined(__clang__)
# pragma GCC diagnostic ignored "-Wformat"
# pragma GCC diagnostic ignored "-Wformat-extra-args"
#endif

static int	g_test = 1;
static int	g_ok = 0;
static int	g_ko = 0;

#define TEST(FMT, ...) do { \
	int ft_ret; \
	int og_ret; \
	printf("\n[%03d] \"%s\"\n", g_test++, FMT); \
	printf("ft : |"); \
	fflush(stdout); \
	ft_ret = ft_printf(FMT, ##__VA_ARGS__); \
	printf("| ret=%d\n", ft_ret); \
	printf("og : |"); \
	fflush(stdout); \
	og_ret = printf(FMT, ##__VA_ARGS__); \
	printf("| ret=%d\n", og_ret); \
	if (ft_ret == og_ret) \
	{ \
		g_ok++; \
		printf("ret: OK\n"); \
	} \
	else \
	{ \
		g_ko++; \
		printf("ret: KO\n"); \
	} \
} while (0)

static void	test_mandatory(void)
{
	char	c;
	char	*null_str;
	char	*str;
	int		n;

	c = 'A';
	null_str = (char *)0;
	str = "hello 42";
	n = -42;
	printf("\n========== MANDATORY ==========" "\n");
	TEST("plain text");
	TEST("char: %c", c);
	TEST("chars: %c %c %c", '0', 0, 'Z');
	TEST("string: %s", str);
	TEST("empty string: %s", "");
	TEST("null string: %s", null_str);
	TEST("pointer: %p", str);
	TEST("null pointer: %p", (void *)0);
	TEST("signed d: %d", n);
	TEST("signed i: %i", n);
	TEST("zero: %d %i %u %x %X", 0, 0, 0, 0, 0);
	TEST("limits: %d %d", INT_MIN, INT_MAX);
	TEST("unsigned max: %u", UINT_MAX);
	TEST("hex: %x %X", 3735928559u, 3735928559u);
	TEST("percent: %%");
	TEST("mixed: %c %s %p %d %i %u %x %X %%", 'B', "mix", &n, -1,
		1, 42u, 255u, 255u);
}

static void	test_width(void)
{
	printf("\n========== WIDTH / LEFT ==========" "\n");
	TEST("%5c", 'a');
	TEST("%-5c", 'a');
	TEST("%10s", "abc");
	TEST("%-10s", "abc");
	TEST("%1s", "abcdef");
	TEST("%5d", 42);
	TEST("%-5d", 42);
	TEST("%5d", -42);
	TEST("%-5d", -42);
	TEST("%5u", 42u);
	TEST("%-5u", 42u);
	TEST("%8x", 48879u);
	TEST("%-8x", 48879u);
	TEST("%12p", &g_test);
	TEST("%-12p", &g_test);
}

static void	test_precision(void)
{
	printf("\n========== PRECISION ==========" "\n");
	TEST("%.0s", "abcdef");
	TEST("%.1s", "abcdef");
	TEST("%.3s", "abcdef");
	TEST("%8.3s", "abcdef");
	TEST("%-8.3s", "abcdef");
	TEST("%.0d", 0);
	TEST("%.0i", 0);
	TEST("%.0u", 0u);
	TEST("%.0x", 0u);
	TEST("%.0X", 0u);
	TEST("%.1d", 0);
	TEST("%.5d", 42);
	TEST("%.5d", -42);
	TEST("%8.5d", 42);
	TEST("%-8.5d", 42);
	TEST("%8.5d", -42);
	TEST("%.5u", 42u);
	TEST("%8.5u", 42u);
	TEST("%.5x", 48879u);
	TEST("%8.5x", 48879u);
	TEST("%8.5X", 48879u);
}

static void	test_zero_flag(void)
{
	printf("\n========== ZERO FLAG ==========" "\n");
	TEST("%05d", 42);
	TEST("%05d", -42);
	TEST("%01d", 42);
	TEST("%010d", INT_MAX);
	TEST("%010d", INT_MIN);
	TEST("%05i", 42);
	TEST("%05u", 42u);
	TEST("%010u", UINT_MAX);
	TEST("%08x", 48879u);
	TEST("%08X", 48879u);
	TEST("%020p", &g_test);
	TEST("%-05d", 42);
	TEST("%05.3d", 42);
	TEST("%05.3d", -42);
	TEST("%08.3x", 48879u);
	TEST("%08.0x", 0u);
}

static void	test_hash_flag(void)
{
	printf("\n========== HASH FLAG ==========" "\n");
	TEST("%#x", 0u);
	TEST("%#X", 0u);
	TEST("%#x", 1u);
	TEST("%#X", 1u);
	TEST("%#x", 48879u);
	TEST("%#X", 48879u);
	TEST("%#8x", 48879u);
	TEST("%#8X", 48879u);
	TEST("%-#8x", 48879u);
	TEST("%#08x", 48879u);
	TEST("%#08X", 48879u);
	TEST("%#.0x", 0u);
	TEST("%#.0X", 0u);
	TEST("%#8.5x", 48879u);
	TEST("%#8.5X", 48879u);
}

static void	test_sign_flags(void)
{
	printf("\n========== PLUS / SPACE ==========" "\n");
	TEST("% d", 42);
	TEST("% d", -42);
	TEST("%+d", 42);
	TEST("%+d", -42);
	TEST("%+i", 0);
	TEST("% i", 0);
	TEST("%+5d", 42);
	TEST("% 5d", 42);
	TEST("%-+5d", 42);
	TEST("%- 5d", 42);
	TEST("%+05d", 42);
	TEST("% 05d", 42);
	TEST("%+05d", -42);
	TEST("%+.5d", 42);
	TEST("% .5d", 42);
	TEST("%+8.5d", 42);
	TEST("% 8.5d", 42);
	TEST("%+8.5d", -42);
	TEST("% +d", 42);
	TEST("% +d", -42);
}

static void	test_bonus_combinations(void)
{
	printf("\n========== BONUS COMBINATIONS ==========" "\n");
	TEST("|%#-12.8x|", 48879u);
	TEST("|%#12.8x|", 48879u);
	TEST("|%#012x|", 48879u);
	TEST("|%#012.8x|", 48879u);
	TEST("|%-+12.8d|", 42);
	TEST("|%+12.8d|", 42);
	TEST("|%+012d|", 42);
	TEST("|%+012.8d|", 42);
	TEST("|%- 12.8d|", 42);
	TEST("|% 12.8d|", 42);
	TEST("|% 012d|", 42);
	TEST("|% 012.8d|", 42);
	TEST("|%#-12.0x|", 0u);
	TEST("|%#12.0x|", 0u);
	TEST("|%+- 012.8d|", 42);
	TEST("|%0-+ 12.8d|", 42);
}

int	main(void)
{
	test_mandatory();
	test_width();
	test_precision();
	test_zero_flag();
	test_hash_flag();
	test_sign_flags();
	test_bonus_combinations();
	printf("\n========== SUMMARY ==========" "\n");
	printf("Return value checks: OK=%d KO=%d\n", g_ok, g_ko);
	printf("If returns are OK, visually compare every ft/og output line too.\n");
	return (g_ko != 0);
}
