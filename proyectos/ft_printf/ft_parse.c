/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   ft_parse.c                                       :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: max <max@student.42.fr>                  +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/24 00:00:00 by max               #+#    #+#             */
/*   Updated: 2026/05/24 00:00:00 by max              ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "ft_printf.h"

static void	ft_init_fmt(t_fmt *fmt)
{
	fmt->left = 0;
	fmt->zero = 0;
	fmt->hash = 0;
	fmt->space = 0;
	fmt->plus = 0;
	fmt->width = 0;
	fmt->precision = 0;
	fmt->has_precision = 0;
	fmt->spec = 0;
}

static int	ft_parse_flags(const char *format, int i, t_fmt *fmt)
{
	while (format[i] == '-' || format[i] == '0' || format[i] == '#'
		|| format[i] == ' ' || format[i] == '+')
	{
		if (format[i] == '-')
			fmt->left = 1;
		else if (format[i] == '0')
			fmt->zero = 1;
		else if (format[i] == '#')
			fmt->hash = 1;
		else if (format[i] == ' ')
			fmt->space = 1;
		else if (format[i] == '+')
			fmt->plus = 1;
		i++;
	}
	return (i);
}

int	ft_parse(const char *format, int i, t_fmt *fmt)
{
	ft_init_fmt(fmt);
	i = ft_parse_flags(format, i, fmt);
	while (ft_isdigit(format[i]))
		fmt->width = fmt->width * 10 + format[i++] - '0';
	if (format[i] == '.')
	{
		fmt->has_precision = 1;
		i++;
		while (ft_isdigit(format[i]))
			fmt->precision = fmt->precision * 10 + format[i++] - '0';
	}
	if (fmt->left)
		fmt->zero = 0;
	if (ft_is_spec(format[i]))
		fmt->spec = format[i++];
	return (i);
}
