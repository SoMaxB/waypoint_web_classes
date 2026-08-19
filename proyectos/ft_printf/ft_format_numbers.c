/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   ft_format_numbers.c                              :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: max <max@student.42.fr>                  +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/24 00:00:00 by max               #+#    #+#             */
/*   Updated: 2026/05/24 00:00:00 by max              ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "ft_printf.h"

int	ft_format_signed(int n, t_fmt *fmt)
{
	unsigned long	value;
	char			*prefix;

	prefix = "";
	if (n < 0)
	{
		value = (unsigned long)(-(long)n);
		prefix = "-";
	}
	else
	{
		value = (unsigned long)n;
		if (fmt->plus)
			prefix = "+";
		else if (fmt->space)
			prefix = " ";
	}
	return (ft_print_number(value, fmt, prefix, 10));
}

int	ft_format_unsigned(unsigned int n, t_fmt *fmt)
{
	return (ft_print_number((unsigned long)n, fmt, "", 10));
}
