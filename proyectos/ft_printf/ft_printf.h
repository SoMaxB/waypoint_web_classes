/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   ft_printf.h                                      :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: max <max@student.42.fr>                  +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/24 00:00:00 by max               #+#    #+#             */
/*   Updated: 2026/05/24 00:00:00 by max              ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#ifndef FT_PRINTF_H
# define FT_PRINTF_H

# include <stdarg.h>
# include <stdlib.h>
# include <unistd.h>

typedef struct s_fmt
{
	int		left;
	int		zero;
	int		hash;
	int		space;
	int		plus;
	int		width;
	int		precision;
	int		has_precision;
	char	spec;
}	t_fmt;

int		ft_printf(const char *format, ...);
int		ft_parse(const char *format, int i, t_fmt *fmt);
int		ft_format(va_list ap, t_fmt *fmt);
int		ft_format_char(int c, t_fmt *fmt);
int		ft_format_string(char *str, t_fmt *fmt);
int		ft_format_percent(t_fmt *fmt);
int		ft_format_signed(int n, t_fmt *fmt);
int		ft_format_unsigned(unsigned int n, t_fmt *fmt);
int		ft_format_hex(unsigned int n, t_fmt *fmt, int uppercase);
int		ft_format_pointer(void *ptr, t_fmt *fmt);
int		ft_print_number(unsigned long n, t_fmt *fmt, char *prefix, int base);
int		ft_putnchar(char c, int n);
int		ft_putstrn(const char *str, int n);
int		ft_strlen(const char *str);
int		ft_isdigit(char c);
int		ft_is_spec(char c);
int		ft_max(int a, int b);

#endif
